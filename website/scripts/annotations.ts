import type { Annotation } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

const ANNOTATION_OVERLAY_ID = '__screenshot_annotation_overlay'

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
// Anchored annotations resolve their geometry from a live DOM element's bounding
// box at capture time, removing the need to hand-tune viewport coordinates.
export async function drawAnnotations(page: Page, annotations: Annotation[]) {
  await clearAnnotations(page)
  await page.evaluate(
    (items, overlayId) => {
      const NS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(NS, 'svg')
      svg.id = overlayId
      svg.setAttribute(
        'style',
        'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none',
      )

      // Resolve an anchor to a live element: a CSS selector, or the
      // smallest-area element whose visible text matches (so a callout can point
      // at a menu item / button without a testid).
      function resolveAnchor(anchor: { selector?: string; text?: string }) {
        if (anchor.selector) {
          return document.querySelector(anchor.selector)
        }
        if (anchor.text) {
          const want = anchor.text.trim().toLowerCase()
          let best: Element | undefined
          let bestArea = Number.POSITIVE_INFINITY
          for (const el of document.querySelectorAll('body *')) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            const txt = (el.textContent !== null ? el.textContent : '')
              .trim()
              .toLowerCase()
            const matches =
              txt === want || (el.childElementCount === 0 && txt.includes(want))
            const rect = el.getBoundingClientRect()
            const area = rect.width * rect.height
            if (
              matches &&
              rect.width > 0 &&
              rect.height > 0 &&
              area < bestArea
            ) {
              best = el
              bestArea = area
            }
          }
          return best ?? null
        }
        return null
      }

      // Apply anchoring: fill in x/y (element center) and, for box/ring shapes,
      // width/height (element bounds + padding), then nudge by dx/dy.
      const resolved = items.map(a => {
        const dx = a.dx ?? 0
        const dy = a.dy ?? 0
        if (!a.anchor) {
          return { ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy }
        }
        const el = resolveAnchor(a.anchor)
        if (!el) {
          return { ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy }
        }
        const r = el.getBoundingClientRect()
        const pad = 6
        // a numbered badge stays a fixed small disc; a hollow ring grows to wrap
        // the anchored element
        const ringRadius = Math.max(r.width, r.height) / 2 + pad
        return {
          ...a,
          x: a.type === 'box' ? r.left - pad + dx : r.left + r.width / 2 + dx,
          y: a.type === 'box' ? r.top - pad + dy : r.top + r.height / 2 + dy,
          width: a.width ?? r.width + pad * 2,
          height: a.height ?? r.height + pad * 2,
          radius: a.radius ?? (a.text ? 16 : ringRadius),
        }
      })

      const defs = document.createElementNS(NS, 'defs')
      const marker = document.createElementNS(NS, 'marker')
      marker.setAttribute('id', 'arrowhead')
      marker.setAttribute('markerWidth', '10')
      marker.setAttribute('markerHeight', '10')
      marker.setAttribute('refX', '8')
      marker.setAttribute('refY', '3')
      marker.setAttribute('orient', 'auto')
      const arrowPath = document.createElementNS(NS, 'path')
      arrowPath.setAttribute('d', 'M0,0 L8,3 L0,6 Z')
      arrowPath.setAttribute('fill', '#e3242b')
      marker.appendChild(arrowPath)
      defs.appendChild(marker)
      svg.appendChild(defs)
      // append the overlay now (before drawing) so text getBBox() resolves for
      // the optional background pill below
      document.body.appendChild(svg)
      for (const a of resolved) {
        const color = a.color ?? '#e3242b'
        const cx = a.x
        const cy = a.y
        if (a.type === 'arrow' && a.from) {
          // anchored arrow: head points at the resolved element center
          const headX = a.anchor ? cx : (a.to?.x ?? 0)
          const headY = a.anchor ? cy : (a.to?.y ?? 0)
          const line = document.createElementNS(NS, 'line')
          line.setAttribute('x1', String(a.from.x))
          line.setAttribute('y1', String(a.from.y))
          line.setAttribute('x2', String(headX))
          line.setAttribute('y2', String(headY))
          line.setAttribute('stroke', color)
          line.setAttribute('stroke-width', '4')
          line.setAttribute('marker-end', 'url(#arrowhead)')
          // recolor the shared arrowhead to match the last arrow's stroke
          arrowPath.setAttribute('fill', color)
          svg.appendChild(line)
        } else if (a.type === 'box') {
          const rect = document.createElementNS(NS, 'rect')
          rect.setAttribute('x', String(cx))
          rect.setAttribute('y', String(cy))
          rect.setAttribute('width', String(a.width ?? 0))
          rect.setAttribute('height', String(a.height ?? 0))
          rect.setAttribute('rx', '4')
          rect.setAttribute('fill', 'none')
          rect.setAttribute('stroke', color)
          rect.setAttribute('stroke-width', String(a.strokeWidth ?? 5))
          svg.appendChild(rect)
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
          svg.appendChild(circle)
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
            svg.appendChild(text)
          }
        } else if (a.type === 'text' && a.text) {
          // Uniform callout style: white pill, red border, black text, larger
          // default font, with word-wrapping once a line exceeds maxWidth.
          const fontFamily = 'system-ui, sans-serif'
          const fontWeight = '600'
          const fontSize = Math.max(a.fontSize ?? 22, 18)
          const maxWidth = a.maxWidth ?? 420
          const measure = (s: string) => {
            const t = document.createElementNS(NS, 'text')
            t.setAttribute('font-family', fontFamily)
            t.setAttribute('font-size', String(fontSize))
            t.setAttribute('font-weight', fontWeight)
            t.textContent = s
            svg.appendChild(t)
            const w = t.getBBox().width
            svg.removeChild(t)
            return w
          }
          const lines: string[] = []
          let cur = ''
          for (const word of a.text.split(/\s+/)) {
            const test = cur ? `${cur} ${word}` : word
            if (cur && measure(test) > maxWidth) {
              lines.push(cur)
              cur = word
            } else {
              cur = test
            }
          }
          if (cur) {
            lines.push(cur)
          }
          const lineHeight = fontSize * 1.25
          const text = document.createElementNS(NS, 'text')
          text.setAttribute('x', String(cx))
          text.setAttribute('y', String(cy))
          text.setAttribute('fill', '#000')
          text.setAttribute('font-family', fontFamily)
          text.setAttribute('font-size', String(fontSize))
          text.setAttribute('font-weight', fontWeight)
          lines.forEach((ln, i) => {
            const tspan = document.createElementNS(NS, 'tspan')
            tspan.setAttribute('x', String(cx))
            tspan.setAttribute('dy', i === 0 ? '0' : String(lineHeight))
            tspan.textContent = ln
            text.appendChild(tspan)
          })
          svg.appendChild(text)
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
          svg.insertBefore(rect, text)
        }
      }
    },
    annotations,
    ANNOTATION_OVERLAY_ID,
  )
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
