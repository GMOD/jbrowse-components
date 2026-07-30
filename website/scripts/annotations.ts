import { graphNodeRect } from './graphAnchor.ts'

import type { ViewportRect } from './graphAnchor.ts'
import type { Annotation, AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

const ANNOTATION_OVERLAY_ID = '__screenshot_annotation_overlay'

interface Region {
  refName: string
  start: number
  end: number
}

// A locus authored on an anchor, pre-parsed here in node so the page-context
// code stays a pure lookup. 1-based inclusive in, interbase out, matching
// core's parseLocString (which needs an assembly-aware isValidRefName callback
// we don't have out here — the refName is instead resolved through the
// assembly's aliases inside the view's own getHighlightCoords).
//
// Splits on the LAST colon, so a refName may contain colons as long as
// coordinates follow it.
function parseLocus(locus: string): Region {
  const cleaned = locus.replaceAll(/[\s,]/g, '')
  const idx = cleaned.lastIndexOf(':')
  const refName = cleaned.slice(0, idx)
  const coords = cleaned.slice(idx + 1)
  const match = /^(\d+)(?:\.\.|-)?(\d+)?$/.exec(coords)
  if (idx === -1 || !match) {
    throw new Error(
      `annotation anchor locus "${locus}" is not <refName>:<start>[-<end>]`,
    )
  }
  const start = Number(match[1]) - 1
  return { refName, start, end: match[2] ? Number(match[2]) : start }
}

type ResolvedAnchor = AnnotationAnchor & {
  region?: Region
  // a graphNode anchor, already resolved to viewport px out here — the graph
  // draws to one canvas, so page context has no element to measure
  rect?: ViewportRect
}

// What actually crosses into page context: the spec's annotation with both of
// its anchors' loci already parsed.
type PayloadAnnotation = Omit<Annotation, 'anchor' | 'fromAnchor'> & {
  anchor?: ResolvedAnchor
  fromAnchor?: ResolvedAnchor
}

// Attach the parsed region so page context never parses strings, plus the
// viewport rect of a graphNode anchor (resolved out here, against the graph
// view's own layout, because the graph is a canvas with nothing to measure).
async function withRegion(
  page: Page,
  anchor: AnnotationAnchor | undefined,
  wantBounds: boolean,
): Promise<ResolvedAnchor | undefined> {
  return anchor
    ? {
        ...anchor,
        region: anchor.locus ? parseLocus(anchor.locus) : undefined,
        rect: anchor.graphNode
          ? await graphNodeRect(page, anchor, wantBounds)
          : undefined,
      }
    : undefined
}

// Remove any annotation overlay left over from a previous frame so staged
// figures don't carry one stage's callouts into the next.
export async function clearAnnotations(page: Page) {
  await page.evaluate(id => {
    document.getElementById(id)?.remove()
  }, ANNOTATION_OVERLAY_ID)
}

// Draw spec.annotations as a fixed SVG overlay covering the viewport so the
// callouts composite into the screenshot, reproducing the red arrows / boxes /
// text labels of hand-made teaching figures without an external image editor.
//
// An anchored annotation resolves its geometry at capture time — from the live
// view model for a genomic locus, or from a DOM element's bounding box for page
// chrome — so no viewport coordinate has to be hand-tuned against a previous
// capture. An anchor that resolves to nothing throws rather than quietly
// parking its callout at the origin.
export async function drawAnnotations(page: Page, annotations: Annotation[]) {
  await clearAnnotations(page)
  const items: PayloadAnnotation[] = await Promise.all(
    annotations.map(async a => ({
      ...a,
      // only a box wants the node's drawn bounds; a ring/arrow/label wants a
      // point on it, and an arrow's tail always does
      anchor: await withRegion(page, a.anchor, a.type === 'box'),
      fromAnchor: await withRegion(page, a.fromAnchor, false),
    })),
  )
  const unresolved = await page.evaluate(
    (items, overlayId) => {
      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(NS, 'svg')
      svg.id = overlayId
      svg.setAttribute(
        'style',
        'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none',
      )

      interface Rect {
        left: number
        top: number
        width: number
        height: number
      }
      type Anchor = ResolvedAnchor | undefined
      // The structural slice of the live view model this needs. Declared here
      // rather than imported because it has to survive serialization into the
      // page, and `window.JBrowseSession` (set by jbrowse-web's JBrowse.tsx) is
      // untyped from a website script.
      interface AnchorableView {
        id: string
        views?: AnchorableView[]
        trackRefs?: Record<string, Element | undefined>
        getHighlightCoords?: (region: {
          refName: string
          start: number
          end: number
        }) => { left: number; width: number } | undefined
      }

      // Model anchoring. The app already knows where a locus is painted, so ask
      // it rather than re-deriving the layout from measured pixels: the track's
      // rendering container is the element the blocks draw into, and
      // getHighlightCoords maps a region into that same space (aliases
      // resolved, scroll subtracted). `window.JBrowseSession` is published by
      // jbrowse-web's JBrowse.tsx.
      function modelRect(anchor: NonNullable<Anchor>): Rect | undefined {
        const path = Array.isArray(anchor.view)
          ? anchor.view
          : [anchor.view ?? 0]
        let view = (window as unknown as { JBrowseSession?: AnchorableView })
          .JBrowseSession
        for (const i of path) {
          view = view?.views?.[i]
        }
        if (!view) {
          return undefined
        }
        const el = anchor.track
          ? view.trackRefs?.[anchor.track]
          : (document.querySelector(
              `[data-testid="view-container-${CSS.escape(view.id)}"] [data-testid="tracksContainer"]`,
            ) ?? undefined)
        if (!el) {
          return undefined
        }
        const r = el.getBoundingClientRect()
        // no fracY anchors the whole track band (what a box wants); a fracY
        // collapses it to one horizontal line through the track (what an arrow
        // head or a text baseline wants)
        const band =
          anchor.fracY === undefined
            ? { top: r.top, height: r.height }
            : { top: r.top + anchor.fracY * r.height, height: 0 }
        if (!anchor.region) {
          return { left: r.left, width: r.width, ...band }
        }
        const coords = view.getHighlightCoords?.(anchor.region)
        if (!coords) {
          return undefined
        }
        return {
          left: r.left + coords.left,
          // getHighlightCoords floors width at 3px so a zoomed-out band stays
          // visible; a point locus wants a true zero so the callout centers on it
          width: anchor.region.end > anchor.region.start ? coords.width : 0,
          ...band,
        }
      }

      // Resolve an anchor to a live element: a CSS selector, or the
      // smallest-area element whose visible text matches (so a callout can point
      // at a menu item / button without a testid).
      function domRect(anchor: NonNullable<Anchor>): Rect | undefined {
        if (anchor.selector) {
          return document
            .querySelector(anchor.selector)
            ?.getBoundingClientRect()
        }
        if (anchor.text) {
          const want = anchor.text.trim().toLowerCase()
          let best: Rect | undefined
          let bestArea = Number.POSITIVE_INFINITY
          for (const el of document.querySelectorAll('body *')) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const txt = (el.textContent !== null ? el.textContent : '')
              .trim()
              .toLowerCase()
            const matches =
              txt === want || (el.childElementCount === 0 && txt.includes(want))
            // getBoundingClientRect forces layout, so only measure the elements
            // that actually matched — this scan walks the whole document, and on
            // a page like the 1104-row TCGA stack measuring every node instead
            // costs thousands of synchronous layouts
            if (matches) {
              const rect = el.getBoundingClientRect()
              const area = rect.width * rect.height
              if (rect.width > 0 && rect.height > 0 && area < bestArea) {
                best = rect
                bestArea = area
              }
            }
          }
          return best
        }
        return undefined
      }

      // a selector/text anchor is always a DOM lookup, so the two kinds can't
      // be silently mixed into an anchor that resolves through neither
      const isModel = (anchor: NonNullable<Anchor>) =>
        anchor.selector === undefined &&
        anchor.text === undefined &&
        (anchor.track !== undefined ||
          anchor.locus !== undefined ||
          anchor.view !== undefined)

      const misses: string[] = []
      function anchorRect(anchor: Anchor) {
        if (!anchor) {
          return undefined
        }
        // a graphNode anchor arrives already resolved (see withRegion); an
        // unresolved one carries no rect and falls through to the miss below
        const rect = anchor.graphNode
          ? anchor.rect
          : isModel(anchor)
            ? modelRect(anchor)
            : domRect(anchor)
        if (!rect) {
          misses.push(JSON.stringify(anchor))
          return undefined
        }
        // built field by field, not spread: domRect hands back a live DOMRect,
        // whose left/top/width/height are prototype getters and so survive
        // neither a spread nor Object.assign
        return {
          left: rect.left + (anchor.dx ?? 0),
          top: rect.top + (anchor.dy ?? 0),
          width: rect.width,
          height: rect.height,
        }
      }

      // Apply anchoring: fill in x/y (element center) and, for box/ring shapes,
      // width/height (element bounds + padding), then nudge by dx/dy.
      const resolved = items.map(a => {
        const dx = a.dx ?? 0
        const dy = a.dy ?? 0
        const from = a.fromAnchor ? anchorRect(a.fromAnchor) : undefined
        const tail = from
          ? { x: from.left + from.width / 2, y: from.top + from.height / 2 }
          : a.from
        const r = anchorRect(a.anchor)
        if (!r) {
          return { ...a, from: tail, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy }
        }
        const pad = 6
        // a numbered badge stays a fixed small disc; a hollow ring grows to wrap
        // the anchored element
        const ringRadius = Math.max(r.width, r.height) / 2 + pad
        return {
          ...a,
          from: tail,
          x: a.type === 'box' ? r.left - pad + dx : r.left + r.width / 2 + dx,
          y: a.type === 'box' ? r.top - pad + dy : r.top + r.height / 2 + dy,
          width: a.width ?? r.width + pad * 2,
          height: a.height ?? r.height + pad * 2,
          radius: a.radius ?? (a.text ? 16 : ringRadius),
        }
      })

      // arrowhead length in marker units (path spans x:0..ARROW_LEN); the line
      // is shortened by this much (scaled by strokeWidth, since markerUnits
      // defaults to strokeWidth) so it ends at the arrowhead's base
      const ARROW_LEN = 8
      const defs = document.createElementNS(NS, 'defs')
      svg.append(defs)
      // One marker per distinct arrow color. A single shared marker recolored
      // per arrow would paint every head in whichever color was drawn last.
      const markerIds = new Map<string, string>()
      function arrowMarker(color: string) {
        const existing = markerIds.get(color)
        if (existing) {
          return existing
        }
        const id = `arrowhead-${markerIds.size}`
        const marker = document.createElementNS(NS, 'marker')
        marker.setAttribute('id', id)
        marker.setAttribute('markerWidth', '10')
        marker.setAttribute('markerHeight', '10')
        // anchor the marker at its BASE (refX=0) so the line stops at the base
        // and the triangle extends forward to the target, covering the line end
        // — this avoids the butt-capped line poking past the sharp tip as a "nub"
        marker.setAttribute('refX', '0')
        marker.setAttribute('refY', '3')
        marker.setAttribute('orient', 'auto')
        const arrowPath = document.createElementNS(NS, 'path')
        arrowPath.setAttribute('d', `M0,0 L${ARROW_LEN},3 L0,6 Z`)
        arrowPath.setAttribute('fill', color)
        marker.append(arrowPath)
        defs.append(marker)
        markerIds.set(color, id)
        return id
      }
      // append the overlay now (before drawing) so text getBBox() resolves for
      // the optional background pill below
      document.body.append(svg)
      for (const a of resolved) {
        const color = a.color ?? '#e3242b'
        const cx = a.x
        const cy = a.y
        if (a.type === 'arrow' && a.from) {
          // anchored arrow: head points at the resolved element center
          const headX = a.anchor ? cx : (a.to?.x ?? 0)
          const headY = a.anchor ? cy : (a.to?.y ?? 0)
          const strokeWidth = a.strokeWidth ?? 4
          // pull the line endpoint back to the arrowhead's base so the triangle
          // (placed base-first at the endpoint) extends forward to the true
          // target; the line end is then hidden under the filled head
          const ddx = headX - a.from.x
          const ddy = headY - a.from.y
          const dist = Math.hypot(ddx, ddy) || 1
          const headLen = ARROW_LEN * strokeWidth
          const endX = headX - (ddx / dist) * headLen
          const endY = headY - (ddy / dist) * headLen
          const line = document.createElementNS(NS, 'line')
          line.setAttribute('x1', String(a.from.x))
          line.setAttribute('y1', String(a.from.y))
          line.setAttribute('x2', String(endX))
          line.setAttribute('y2', String(endY))
          line.setAttribute('stroke', color)
          // the arrowhead marker uses markerUnits=strokeWidth, so a thinner
          // line also shrinks the head proportionally
          line.setAttribute('stroke-width', String(strokeWidth))
          line.setAttribute('marker-end', `url(#${arrowMarker(color)})`)
          svg.append(line)
        } else if (a.type === 'box') {
          const rect = document.createElementNS(NS, 'rect')
          rect.setAttribute('x', String(cx))
          rect.setAttribute('y', String(cy))
          rect.setAttribute('width', String(a.width ?? 0))
          rect.setAttribute('height', String(a.height ?? 0))
          rect.setAttribute('rx', '4')
          // a positive fillOpacity tints the box with a translucent wash of its
          // own colour (a "light green/orange" highlight); otherwise hollow
          rect.setAttribute('fill', a.fillOpacity ? color : 'none')
          if (a.fillOpacity) {
            rect.setAttribute('fill-opacity', String(a.fillOpacity))
          }
          rect.setAttribute('stroke', color)
          rect.setAttribute('stroke-width', String(a.strokeWidth ?? 5))
          svg.append(rect)
        } else if (a.type === 'circle') {
          const radius = a.radius ?? 16
          const circle = document.createElementNS(NS, 'circle')
          circle.setAttribute('cx', String(cx))
          circle.setAttribute('cy', String(cy))
          circle.setAttribute('r', String(radius))
          circle.setAttribute('stroke', color)
          circle.setAttribute('stroke-width', String(a.strokeWidth ?? 5))
          // filled badge when it carries a label, hollow ring otherwise
          circle.setAttribute('fill', a.text ? color : 'none')
          svg.append(circle)
          if (a.text) {
            const text = document.createElementNS(NS, 'text')
            text.setAttribute('x', String(cx))
            text.setAttribute('y', String(cy))
            text.setAttribute('fill', a.textColor ?? '#fff')
            text.setAttribute('text-anchor', 'middle')
            text.setAttribute('dominant-baseline', 'central')
            text.setAttribute('font-family', 'system-ui, sans-serif')
            text.setAttribute('font-size', String(a.fontSize ?? 18))
            text.setAttribute('font-weight', '700')
            text.textContent = a.text
            svg.append(text)
          }
        } else if (a.type === 'text' && a.text) {
          // Uniform callout style: white pill, red border, black text, larger
          // default font, with word-wrapping once a line exceeds maxWidth.
          const fontFamily = 'system-ui, sans-serif'
          const fontWeight = '600'
          const fontSize = Math.max(a.fontSize ?? 22, 13)
          const maxWidth = a.maxWidth ?? 420
          const measure = (s: string) => {
            const t = document.createElementNS(NS, 'text')
            t.setAttribute('font-family', fontFamily)
            t.setAttribute('font-size', String(fontSize))
            t.setAttribute('font-weight', fontWeight)
            t.textContent = s
            svg.append(t)
            const w = t.getBBox().width
            t.remove()
            return w
          }
          // A newline in the text is a hard break, so a callout can author a
          // list; each resulting paragraph then word-wraps on its own within
          // maxWidth. (Splitting the whole string on /\s+/ instead silently
          // flattened an authored list into one run-on paragraph.) An empty
          // paragraph — from a blank line — becomes a '' entry, drawn below as
          // a gap rather than a tspan.
          const lines: string[] = []
          for (const paragraph of a.text.split('\n')) {
            const words = paragraph.trim()
            if (words === '') {
              lines.push('')
            } else {
              let cur = ''
              for (const word of words.split(/\s+/)) {
                const test = cur ? `${cur} ${word}` : word
                if (cur && measure(test) > maxWidth) {
                  lines.push(cur)
                  cur = word
                } else {
                  cur = test
                }
              }
              lines.push(cur)
            }
          }
          const lineHeight = fontSize * 1.25
          const text = document.createElementNS(NS, 'text')
          text.setAttribute('x', String(cx))
          text.setAttribute('y', String(cy))
          text.setAttribute('fill', '#000')
          text.setAttribute('font-family', fontFamily)
          text.setAttribute('font-size', String(fontSize))
          text.setAttribute('font-weight', fontWeight)
          // An empty tspan gets no layout, so a blank line can't be drawn as
          // one: carry its half-line gap into the next real line's dy instead.
          let gap = 0
          let isFirst = true
          for (const ln of lines) {
            if (ln === '') {
              gap += lineHeight * 0.5
            } else {
              const tspan = document.createElementNS(NS, 'tspan')
              tspan.setAttribute('x', String(cx))
              tspan.setAttribute('dy', isFirst ? '0' : String(lineHeight + gap))
              tspan.textContent = ln
              text.append(tspan)
              gap = 0
              isFirst = false
            }
          }
          svg.append(text)
          const bbox = text.getBBox()
          const padX = 10
          const padY = 7
          const rect = document.createElementNS(NS, 'rect')
          rect.setAttribute('x', String(bbox.x - padX))
          rect.setAttribute('y', String(bbox.y - padY))
          rect.setAttribute('width', String(bbox.width + padX * 2))
          rect.setAttribute('height', String(bbox.height + padY * 2))
          rect.setAttribute('rx', '6')
          rect.setAttribute('fill', '#fff')
          rect.setAttribute('stroke', a.color ?? '#e3242b')
          rect.setAttribute('stroke-width', '3')
          text.before(rect)
        }
      }
      return misses
    },
    items,
    ANNOTATION_OVERLAY_ID,
  )
  // An anchor that resolves to nothing silently falls back to (x ?? 0, y ?? 0),
  // which parks the callout in the top-left corner rather than removing it — a
  // failure that looks like a styling mistake in review instead of a stale
  // spec. Surface it as the error it is.
  if (unresolved.length > 0) {
    throw new Error(
      `annotation anchors resolved to nothing: ${unresolved.join(', ')}`,
    )
  }
}

export async function hideLingeringTooltip(page: Page) {
  // BaseTooltip renders into a portal with inline z-index:100000 (MUI menus
  // use 1300), so this targets the lingering hover tooltip without touching
  // the context menu we want to keep.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('div')) {
      if (el.style.zIndex === '100000') {
        el.style.display = 'none'
      }
    }
  })
}
