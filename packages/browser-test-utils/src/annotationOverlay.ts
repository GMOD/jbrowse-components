// The callout overlay shared by the two screenshot harnesses: the website's
// puppeteer generator (`website/scripts/annotations.ts`) and the desktop
// selenium one (`products/jbrowse-desktop/test/annotations.ts`). Both inject
// `drawAnnotationOverlay` into page context — puppeteer through
// `page.evaluate`, selenium through `executeScript` — so a callout drawn on a
// desktop figure is the same shape, color and geometry as one drawn on a web
// figure, and neither can drift from the other.
//
// Everything below the types is deliberately import-free: the function is
// serialized to source and evaluated in the page, so anything it closes over
// out here would be undefined in there.

// What an annotation attaches itself to, resolved at capture time so the
// callout tracks the real thing instead of a hand-measured pixel. Four kinds,
// in decreasing order of preference:
//
// - `track` + `locus`: MODEL anchoring. Reads the live LGV model
//   (`window.JBrowseSession`) for the track's rendering container and the
//   locus's pixel position, so a callout lands on a genomic coordinate. Nothing
//   to re-measure when a track height, viewport width, or zoom changes. Use
//   this for anything pointing at data.
// - `chord`: a circular view chord, named by part of its `<title>`. Hit-tested
//   along the curve, so the point it resolves to is one a click reaches rather
//   than one that is merely on the geometry.
// - `graphNode`: MODEL anchoring for a GraphGenomeView. A graph is one canvas
//   with no element per node, so a callout at a node used to be a raw viewport
//   coordinate that only held while the layout was deterministic — changing
//   `layoutMode` silently moved every one of them. This reads the view's own
//   `nodePositions` through its `scale`/`translateX`/`translateY`, so a node is
//   named by its GFA segment id and the layout can change underneath it.
// - `selector`: the first matching element.
// - `text`: the smallest-area element whose visible text matches — for menu
//   items and buttons with no testid. Scans the whole document, so prefer
//   `selector` where one exists.
export interface AnnotationAnchor {
  selector?: string
  text?: string
  // Part of a circular view chord's own `<title>` -- the record's name and both
  // of its loci, e.g. 'SV_20'. Resolved by the caller
  // (`website/scripts/chordAnchor.ts`), which hit-tests along the curve rather
  // than measuring it: a chord is a Bezier, so its bounding-box centre is not on
  // it, and its midpoint is where every other chord bundles.
  chord?: string
  // GFA segment id in the `view`-th view, which must be a GraphGenomeView. The
  // resolved rect is the node's drawn polyline bounds in viewport px.
  graphNode?: string
  // the two axes of a DotplotView, as `4A` (the whole chromosome) or
  // `4A:1-5,000,000`. The resolved rect is the grid cell the pair makes, which
  // for two bare refNames is the box an off-diagonal block sits in. Naming one
  // axis spans the plot on the other. Resolved by the caller
  // (`website/scripts/dotplotAnchor.ts`) — the plot is one canvas, so there is
  // nothing here to measure.
  hLocus?: string
  vLocus?: string
  // which view to resolve against: an index into `session.views` (default 0).
  // An array descends through nested `.views` — `[0, 1]` is the second LGV of a
  // comparative/breakpoint-split view.
  view?: number | number[]
  // config `trackId` of the track supplying the y band and the x origin. Its
  // rendering container is the same element the blocks draw into, so a locus
  // resolved against it lands exactly where the feature is painted. On its own
  // (no `locus`) it anchors to the whole track.
  track?: string
  // A selector, matched INSIDE the view, whose vertical band the point lands in
  // — the third way of choosing the y after `track` and the default tracks
  // area. The x still comes from the locus, which is what makes it useful: the
  // scalebar a rubberband is drawn on spans exactly the tracks' x-range and
  // sits above them, so `{ locus, band: '[data-testid="rubberband_controls"]' }`
  // is a drag on the ruler with no measured pixel in it.
  //
  // Read by `website/scripts/locusAnchor.ts`, the same way `hLocus`/`vLocus` are
  // read by dotplotAnchor: a callout has no use for it, since what a callout
  // points at is a track or a feature.
  band?: string
  // '8:127,735,434' or '8:127,700,000-127,800,000' — 1-based, commas optional,
  // aliases resolved through the assembly (so 'chr8' works on a bare-named
  // assembly). Without `track` or `band` the view's whole tracks area is used.
  locus?: string
  // where in the track's height to put the anchor point: 0 = top, 1 = bottom.
  // Omit to anchor to the whole track band (what a `box` wants).
  //
  // A fraction only means something when the track FITS the capture. A display
  // taller than the viewport runs off the bottom edge, and a fraction of its
  // height then lands outside the frame — there, use `fracY: 0` with a `dy`, so
  // the offset is measured down from the track's top edge (see
  // `tcga/cohort_cnv_genome`, ~1105px of stack in a 1120px viewport).
  fracY?: number
  // which point of the resolved rect the callout attaches to, before `dx`/`dy`.
  // Both default to 'center'. A badge or a label that has to sit BESIDE a
  // control rather than on top of it needs this: the element's own width is
  // what separates them, and that width is only known at capture time, so a
  // hand-written `dx` off the center would have to encode it (and would move
  // the moment the label inside the control changed). `box` ignores these — it
  // always wraps the whole rect.
  //
  // Read on `fromAnchor` too, so an arrow's two ends align the same way: both
  // ends of a vertical arrow down a track say `alignX: 'left'` and mean it.
  alignX?: 'left' | 'center' | 'right'
  alignY?: 'top' | 'center' | 'bottom'
  // px nudge off the resolved position, for readability only — separating two
  // labels whose loci are a few px apart, or lifting an arrow tail clear of the
  // pill it leaves from. On the annotation's primary `anchor` this is equivalent
  // to the annotation's own `dx`/`dy`; on `fromAnchor` it is the only `dx`/`dy`
  // there is, the annotation's own applying to the head.
  dx?: number
  dy?: number
  // a HORIZONTAL SUB-SPAN of the resolved rect, as two fractions of its width.
  // Only 'trapezoid' reads it, and it exists for the one case that rect has no
  // finer handle in: a compose part, which is a flat image with no elements
  // inside it, where the thing a lineage indicator has to point at is a
  // FRACTION of a wider figure (one chromosome of six, one window of a genome).
  //
  // A fraction, not a pixel, so it is derived rather than measured — the caller
  // computes it from the same region lengths the part's own spec lays out, and
  // the ~0.5% the app frame's own margin costs is under a pixel of slant at any
  // real figure width.
  fracX?: [number, number]
}

// A callout drawn over the captured page (SVG overlay) before the screenshot,
// to reproduce the red arrows / boxes / text labels that hand-made teaching
// figures use. Coordinates are viewport CSS px.
//
// Prefer `anchor` over raw x/y in every case: an anchored callout resolves its
// geometry at capture time, a hand-tuned coordinate goes stale silently.
// `dx`/`dy` nudge the anchored position.
export interface Annotation {
  // arrow: tail -> head; box/highlight: x/y/width/height (ring around a region);
  // text: x/y baseline; circle: filled numbered badge (with text) or an outline
  // ring around the anchored element (without text); legend: a color key pill,
  // one swatch-and-label row per `entries` item; trapezoid: a lineage wedge
  // joining `fromAnchor`'s facing edge to `anchor`'s, which is how a zoomed
  // panel is shown to come FROM a span of a wider one
  type: 'arrow' | 'box' | 'text' | 'circle' | 'legend' | 'trapezoid'
  // for 'legend': the color key itself. A display that identifies its rows by a
  // color the figure never names (thousands of sub-pixel rows, an overlay whose
  // in-app legend is off screen) needs the mapping in the frame; authoring it
  // from the track's own subadapter colors keeps it from drifting off the data.
  entries?: { label: string; color: string }[]
  from?: { x: number; y: number }
  to?: { x: number; y: number }
  x?: number
  y?: number
  width?: number
  height?: number
  radius?: number // circle radius (default 16, or derived from anchored element)
  // gap in CSS px between the anchored element's box and the drawn 'box' or
  // ring (default 6). Raise it when the element carries its own label outside
  // its bounding box, which a graph node does: the box is drawn to the node's
  // stroke and the renderer writes "43 bp" across it, so at the default the
  // border lands over the first character. This is a padding, not a position —
  // it stays anchored and does not have to be re-measured when a layout moves.
  pad?: number
  text?: string
  color?: string // default red (#e3242b); also the 'text' pill border color
  textColor?: string // circle badge label color (circle default white)
  // for 'text': a white rounded pill with a red border and black text is always
  // drawn behind the label so callouts read consistently over busy page content.
  // (background/textColor are ignored for 'text' to keep every callout uniform.)
  background?: string
  // for 'text': wrap the label onto multiple lines once it exceeds this width in
  // CSS px (default 420). A newline in `text` is a hard break — so a callout can
  // author a list — and each line still wraps to maxWidth on its own; a blank
  // line becomes a paragraph gap.
  maxWidth?: number
  // for 'text': which end of the pill sits at x. 'end' right-aligns it, which
  // is what a label placed to the LEFT of what it names needs — the pill has to
  // end at the control's edge, and its own width is only known once the text is
  // measured in the page.
  //
  // A `leader` pill ignores this for placement — `dx`'s sign already says which
  // side the label hangs on — and reads it only as the justification of a
  // multi-line label.
  textAlign?: 'start' | 'end'
  // for 'text': draw the pill's own arrow back to what it names, and make ONE
  // annotation of the label and the arrow.
  //
  // A label and a separate arrow cannot be kept together by hand. The tail has
  // to sit at the pill's edge, the pill's width is only known once its text is
  // measured in the page, and a spec can only guess it: the same pair of
  // hand-written offsets left "IGF1" floating 50px clear of its arrow and
  // swallowed "IGF2BP2"'s tail inside the pill, because the two labels are
  // different lengths. With `leader` the tail is the measured pill's own
  // boundary in the target's direction, so neither can happen at any label
  // length, font size or placement.
  //
  // The anchor is then what the callout NAMES, and `dx`/`dy` place the label off
  // it: `dx`'s sign picks the side, its magnitude is the gap between the target
  // and the pill's facing edge (so a column of callouts lines up whatever each
  // one says), and `dy` centres the pill on that line.
  leader?: boolean
  fontSize?: number // text/circle label, default 22 for text (min 18)
  strokeWidth?: number // box/circle stroke width (default 5); arrow line+head (default 4)
  fillOpacity?: number // box: tint the interior with a translucent wash of color
  anchor?: AnnotationAnchor
  // for 'arrow' with an anchored head: the tail can be anchored too, so a
  // callout's whole geometry is model-derived. Same shape as `anchor`, read the
  // same way (`alignX`/`alignY` included); `from` is the raw-pixel fallback.
  fromAnchor?: AnnotationAnchor
  dx?: number
  dy?: number
}

export interface AnnotationRegion {
  refName: string
  start: number
  end: number
}

// An anchor as it crosses into page context: a locus already parsed out here
// (page context stays a pure lookup), plus the viewport rect of a graphNode
// anchor, which the graph view can only resolve outside the page because it
// draws to one canvas with no element to measure.
export type ResolvedAnnotationAnchor = AnnotationAnchor & {
  region?: AnnotationRegion
  rect?: { left: number; top: number; width: number; height: number }
}

export type PayloadAnnotation = Omit<Annotation, 'anchor' | 'fromAnchor'> & {
  anchor?: ResolvedAnnotationAnchor
  fromAnchor?: ResolvedAnnotationAnchor
}

export const ANNOTATION_OVERLAY_ID = '__screenshot_annotation_overlay'

// A locus authored on an anchor, pre-parsed out here in node so the
// page-context code stays a pure lookup. 1-based inclusive in, interbase out,
// matching core's parseLocString (which needs an assembly-aware isValidRefName
// callback we don't have out here — the refName is instead resolved through the
// assembly's aliases inside the view's own getHighlightCoords).
//
// Splits on the LAST colon, so a refName may contain colons as long as
// coordinates follow it.
export function parseAnnotationLocus(
  locus: string,
  // What a SINGLE coordinate means, which depends on the callout drawn from it.
  // An arrow head or a text pill points AT the position, and the zero-width
  // interval between two bases is the honest answer for that — it is what the
  // callout centres on. A box has to wrap it, and a box built on that same
  // zero-width region is centred on the boundary rather than around the base:
  // the column ends up in one half of the frame with the stroke drawn over it,
  // which is what "the boxes cover up the variant they are trying to show"
  // looked like at one base per ~6 css px. `wrap` asks for the base's own
  // column instead. (`locusAnchor.ts`'s click parser always wants the base, for
  // the neighbouring reason: a click cannot land on an edge.)
  wrap = false,
): AnnotationRegion {
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
  const end = match[2] ? Number(match[2]) : wrap ? start + 1 : start
  return { refName, start, end }
}

// The two ways a callout fails to say what its spec asked it to, each entry a
// JSON blob naming the item. Both are empty on a good run, and either one is an
// error at the caller — kept apart because they need different fixes: an
// unresolved anchor is a stale selector or a renamed label, while an off-frame
// draw is a correct anchor the capture cannot see.
export interface AnnotationOverlayProblems {
  unresolved: string[]
  offFrame: string[]
}

// Draw the annotations as a fixed SVG overlay covering the viewport so the
// callouts composite into the screenshot, reproducing the red arrows / boxes /
// text labels of hand-made teaching figures without an external image editor.
//
// Runs in PAGE CONTEXT (serialized to source by both harnesses), so it takes no
// imports and returns plain data: the anchors that resolved to nothing, and the
// items that resolved but drew outside the capture. The caller turns either into
// a thrown error rather than leaving a callout parked at the origin or shipping
// a figure the callout is missing from.
export function drawAnnotationOverlay(
  items: PayloadAnnotation[],
  overlayId: string,
): AnnotationOverlayProblems {
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
  type Anchor = ResolvedAnnotationAnchor | undefined
  // The structural slice of the live view model this needs. Declared here
  // rather than imported because it has to survive serialization into the
  // page, and `window.JBrowseSession` (set by jbrowse-web's JBrowse.tsx, and by
  // the desktop app's) is untyped from a harness script.
  interface AnchorableView {
    id: string
    views?: AnchorableView[]
    assemblyNames?: string[]
    trackRefs?: Record<string, Element | undefined>
    getHighlightCoords?: (region: {
      assemblyName?: string
      refName: string
      start: number
      end: number
    }) => { left: number; width: number } | undefined
  }

  // Model anchoring. The app already knows where a locus is painted, so ask
  // it rather than re-deriving the layout from measured pixels: the track's
  // rendering container is the element the blocks draw into, and
  // getHighlightCoords maps a region into that same space (aliases
  // resolved, scroll subtracted).
  function modelRect(anchor: NonNullable<Anchor>): Rect | undefined {
    const path = Array.isArray(anchor.view) ? anchor.view : [anchor.view ?? 0]
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
    // the view's own assembly, so getHighlightCoords resolves the locus's
    // refName through it: without a name it cannot, and a 'chr1' authored
    // against an assembly whose canonical refName is '1' resolves to nothing
    const coords = view.getHighlightCoords?.({
      ...anchor.region,
      assemblyName: view.assemblyNames?.[0],
    })
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
      return document.querySelector(anchor.selector)?.getBoundingClientRect()
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
    // a graph-node or dotplot anchor arrives already resolved by the caller —
    // both are one canvas with nothing per feature to measure in here — and an
    // unresolved one carries no rect, so it falls through to the miss below
    const preResolved =
      anchor.graphNode !== undefined ||
      anchor.hLocus !== undefined ||
      anchor.vLocus !== undefined
    const rect = preResolved
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

  // Which point of a resolved rect an anchor names. Both ends of an arrow read
  // it, so a tail can sit at an element's edge the same way a head can. It used
  // to be inlined for the head only, and a tail carrying an `alignX` was
  // silently the rect's centre instead: tcga/mutations_cdh1_histology asked for
  // a short vertical arrow at a track's left edge + 400 and drew a diagonal
  // across the whole panel, because a track's rect is the full view width and
  // half of that is what the tail was off by.
  function anchorPoint(rect: Rect, anchor: Anchor) {
    const alignX = anchor?.alignX ?? 'center'
    const alignY = anchor?.alignY ?? 'center'
    return {
      x:
        alignX === 'left'
          ? rect.left
          : alignX === 'right'
            ? rect.left + rect.width
            : rect.left + rect.width / 2,
      y:
        alignY === 'top'
          ? rect.top
          : alignY === 'bottom'
            ? rect.top + rect.height
            : rect.top + rect.height / 2,
    }
  }

  // Apply anchoring: fill in x/y (the anchor's point on the element) and, for
  // box/ring shapes, width/height (element bounds + padding), then nudge by
  // dx/dy.
  const resolved = items.map(a => {
    const dx = a.dx ?? 0
    const dy = a.dy ?? 0
    const from = a.fromAnchor ? anchorRect(a.fromAnchor) : undefined
    const tail = from ? anchorPoint(from, a.fromAnchor) : a.from
    const r = anchorRect(a.anchor)
    if (!r) {
      return {
        ...a,
        from: tail,
        x: (a.x ?? 0) + dx,
        y: (a.y ?? 0) + dy,
        target: undefined as { x: number; y: number } | undefined,
        fromRect: from,
        toRect: undefined as Rect | undefined,
      }
    }
    const pad = a.pad ?? 6
    // a numbered badge stays a fixed small disc; a hollow ring grows to wrap
    // the anchored element
    const ringRadius = Math.max(r.width, r.height) / 2 + pad
    const { x: px, y: py } = anchorPoint(r, a.anchor)
    // A box's pad goes outward where there is room and inward where there is
    // not. An element flush against the window edge — a docked drawer, a panel
    // pinned to the right — has no outside on that side, so a stroke drawn
    // there is off frame: the track-settings figure kept exactly one of its four
    // edges, a red line hovering in the page margin with nothing to read it
    // against. Clamped to the stroke's own half-width so the whole line lands.
    const inset = (a.strokeWidth ?? 5) / 2
    const boxLeft = Math.max(inset, r.left - pad + dx)
    const boxTop = Math.max(inset, r.top - pad + dy)
    const boxRight = Math.min(
      window.innerWidth - inset,
      r.left + r.width + pad + dx,
    )
    const boxBottom = Math.min(
      window.innerHeight - inset,
      r.top + r.height + pad + dy,
    )
    return {
      ...a,
      from: tail,
      x: a.type === 'box' ? boxLeft : px + dx,
      y: a.type === 'box' ? boxTop : py + dy,
      // the anchored point BEFORE the annotation's own dx/dy, which for a
      // `leader` pill is the difference between where the label sits and what it
      // names — the arrow needs both
      target: { x: px, y: py },
      width: a.width ?? boxRight - boxLeft,
      height: a.height ?? boxBottom - boxTop,
      radius: a.radius ?? (a.text ? 16 : ringRadius),
      // A trapezoid is the one shape that needs both anchors as RECTS rather
      // than as points: its two horizontal edges are the two elements' facing
      // edges, so the widths are the geometry and not a decoration on it.
      fromRect: from,
      toRect: r,
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
  // One line with a head on it, shared by the `arrow` annotation and by the
  // arrow a `leader` pill draws for itself, so the two cannot end up different
  // marks in the same figure.
  function drawArrowLine(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string,
    strokeWidth: number,
  ) {
    // pull the line endpoint back to the arrowhead's base so the triangle
    // (placed base-first at the endpoint) extends forward to the true target;
    // the line end is then hidden under the filled head
    const ddx = to.x - from.x
    const ddy = to.y - from.y
    const dist = Math.hypot(ddx, ddy) || 1
    const headLen = ARROW_LEN * strokeWidth
    const line = document.createElementNS(NS, 'line')
    line.setAttribute('x1', String(from.x))
    line.setAttribute('y1', String(from.y))
    line.setAttribute('x2', String(to.x - (ddx / dist) * headLen))
    line.setAttribute('y2', String(to.y - (ddy / dist) * headLen))
    line.setAttribute('stroke', color)
    // the arrowhead marker uses markerUnits=strokeWidth, so a thinner line also
    // shrinks the head proportionally
    line.setAttribute('stroke-width', String(strokeWidth))
    line.setAttribute('marker-end', `url(#${arrowMarker(color)})`)
    return line
  }

  // How much air a leader leaves at each end: clear of the pill's border so the
  // tail is not drawn on it, and short of the target so the head names a point
  // without covering it.
  const LEADER_TAIL_GAP = 5
  const LEADER_HEAD_GAP = 14

  // The arrow a `leader` pill draws back to what it names. The tail is the point
  // where the target's direction leaves the MEASURED pill, so it is the pill's
  // own edge at any label length and at any angle; nothing here is a written
  // offset. Undefined when the pill covers the target, which the caller reports
  // rather than drawing a backwards arrow.
  function leaderArrow(
    pill: Rect,
    target: { x: number; y: number },
    color: string,
    strokeWidth: number,
  ) {
    const midX = pill.left + pill.width / 2
    const midY = pill.top + pill.height / 2
    const dx = target.x - midX
    const dy = target.y - midY
    const dist = Math.hypot(dx, dy)
    if (dist === 0) {
      return undefined
    }
    // the pill boundary along that direction: whichever of the two half-extents
    // the ray reaches first
    const edge = Math.min(
      Math.abs(dx) > 0 ? pill.width / 2 / Math.abs(dx) : Infinity,
      Math.abs(dy) > 0 ? pill.height / 2 / Math.abs(dy) : Infinity,
    )
    const start = edge * dist + LEADER_TAIL_GAP
    const end = dist - LEADER_HEAD_GAP
    if (!(end > start)) {
      return undefined
    }
    const at = (d: number) => ({
      x: midX + (dx / dist) * d,
      y: midY + (dy / dist) * d,
    })
    return drawArrowLine(at(start), at(end), color, strokeWidth)
  }

  // append the overlay now (before drawing) so text getBBox() resolves for
  // the optional background pill below
  document.body.append(svg)
  // Text pills paint last, over every arrow and box, whatever order the spec
  // listed them in. An arrow that names a pill has to start inside it: the
  // pill's width is only known once the text is measured in the page, so a
  // spec can place the tail near the pill but never exactly at its edge, and
  // the leftover line drawn across the white callout reads as a mistake.
  // Sorting here rather than asking every spec to list its pills last, which
  // is a rule nothing would check.
  const isPill = (t: string) => t === 'text' || t === 'legend'
  const drawOrder = [
    ...resolved.filter(a => !isPill(a.type)),
    ...resolved.filter(a => isPill(a.type)),
  ]

  // An anchor that resolves and THEN draws outside the capture is the other
  // half of the miss above, and the half nothing caught: the callout is correct,
  // the spec is correct, and the figure ships without it. Measured from what was
  // actually drawn rather than from the intended geometry, because a pill's own
  // size is only known once its text is measured in the page.
  //
  // Reported only when the item lands ENTIRELY outside. A partial clip is left
  // alone deliberately — a box already clamps its pad inward at the frame edge,
  // so the shapes that reach the edge do so on purpose, and a threshold on
  // "mostly visible" would fire on those without a measurement to set it from.
  const offFrame: string[] = []
  // jsdom, where this file's unit tests run, measures every element as a zero
  // rect; taken at face value that calls every callout off-frame. A zero-sized
  // overlay root is how "no layout here" reads from inside page context.
  const canMeasure = svg.getBoundingClientRect().width > 0
  function reportIfOffFrame(a: (typeof drawOrder)[number], from: number) {
    const drawn = [...svg.children].slice(from)
    if (!canMeasure || drawn.length === 0) {
      return
    }
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const el of drawn) {
      const r = el.getBoundingClientRect()
      left = Math.min(left, r.left)
      top = Math.min(top, r.top)
      right = Math.max(right, r.right)
      bottom = Math.max(bottom, r.bottom)
    }
    // Does the drawn box INTERSECT the viewport — not does the intersection
    // have area. A perfectly vertical arrow (both ends on one x, which two
    // anchors sharing a locus give you) has a zero-width box, and measured as
    // an area it has none wherever it sits: an arrow in the middle of the frame
    // reported as invisible and failed its whole figure.
    if (
      right >= 0 &&
      left <= window.innerWidth &&
      bottom >= 0 &&
      top <= window.innerHeight
    ) {
      return
    }
    offFrame.push(
      JSON.stringify({
        type: a.type,
        text: a.text,
        anchor: a.anchor,
        drawn: { left, top, right, bottom },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    )
  }

  for (const a of drawOrder) {
    const drawnFrom = svg.childElementCount
    const color = a.color ?? '#e3242b'
    const cx = a.x
    const cy = a.y
    if (a.type === 'arrow' && a.from) {
      // anchored arrow: head points at the resolved element center
      svg.append(
        drawArrowLine(
          a.from,
          {
            x: a.anchor ? cx : (a.to?.x ?? 0),
            y: a.anchor ? cy : (a.to?.y ?? 0),
          },
          color,
          a.strokeWidth ?? 4,
        ),
      )
    } else if (a.type === 'trapezoid' && a.fromRect && a.toRect) {
      // The lineage wedge: `fromAnchor` is the span the zoom came FROM,
      // `anchor` the panel it opened into, and the two horizontal edges are
      // those two elements' own facing edges. Which pair of edges face each
      // other is read off the rects rather than declared, so the same
      // annotation works whichever way round the composition stacks its parts.
      const A = a.fromRect
      const B = a.toRect
      const span = (
        r: Rect,
        anchor?: { fracX?: [number, number] },
      ): [number, number] => {
        const [f0, f1] = anchor?.fracX ?? [0, 1]
        return [r.left + r.width * f0, r.left + r.width * f1]
      }
      const [aLeft, aRight] = span(A, a.fromAnchor)
      const [bLeft, bRight] = span(B, a.anchor)
      const aAbove = A.top + A.height / 2 < B.top + B.height / 2
      const aY = aAbove ? A.top + A.height : A.top
      const bY = aAbove ? B.top : B.top + B.height
      const poly = document.createElementNS(NS, 'polygon')
      poly.setAttribute(
        'points',
        `${aLeft},${aY} ${aRight},${aY} ${bRight},${bY} ${bLeft},${bY}`,
      )
      poly.setAttribute('fill', color)
      poly.setAttribute('fill-opacity', String(a.fillOpacity ?? 0.14))
      poly.setAttribute('stroke', 'none')
      svg.append(poly)
      // Only the SLANTED sides are stroked. The other two are the panels' own
      // edges, and a line drawn along one of them reads as a border the figure
      // grew rather than as part of the wedge.
      for (const [x1, x2] of [
        [aLeft, bLeft],
        [aRight, bRight],
      ]) {
        const side = document.createElementNS(NS, 'line')
        side.setAttribute('x1', String(x1))
        side.setAttribute('y1', String(aY))
        side.setAttribute('x2', String(x2))
        side.setAttribute('y2', String(bY))
        side.setAttribute('stroke', color)
        side.setAttribute('stroke-width', String(a.strokeWidth ?? 3))
        svg.append(side)
      }
    } else if (a.type === 'trapezoid') {
      // A trapezoid with only one end is not a shape. Reported rather than
      // skipped, because the caller turns misses into a thrown error and a
      // silently-undrawn lineage wedge is exactly the kind of thing that gets
      // committed.
      misses.push(
        JSON.stringify({
          trapezoid: 'needs both anchor and fromAnchor to resolve',
          anchor: a.anchor,
          fromAnchor: a.fromAnchor,
        }),
      )
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
    } else if (a.type === 'legend' && a.entries?.length) {
      // A color key: swatch + label per row, in one white pill styled like the
      // text callout so the two read as the same annotation vocabulary. The
      // pill's width comes from the measured labels, so nothing here is a
      // hand-tuned box that goes stale when an entry is renamed.
      const fontFamily = 'system-ui, sans-serif'
      const fontSize = Math.max(a.fontSize ?? 20, 13)
      const swatch = fontSize
      const gap = Math.round(fontSize * 0.5)
      const rowHeight = Math.round(fontSize * 1.5)
      const padX = 12
      const padY = 10
      const group = document.createElementNS(NS, 'g')
      svg.append(group)
      const labels = document.createElementNS(NS, 'text')
      labels.setAttribute('fill', '#000')
      labels.setAttribute('font-family', fontFamily)
      labels.setAttribute('font-size', String(fontSize))
      labels.setAttribute('font-weight', '600')
      labels.setAttribute('dominant-baseline', 'central')
      group.append(labels)
      for (const [i, entry] of a.entries.entries()) {
        const tspan = document.createElementNS(NS, 'tspan')
        tspan.setAttribute('x', '0')
        tspan.setAttribute('y', String(i * rowHeight + rowHeight / 2))
        tspan.textContent = entry.label
        labels.append(tspan)
      }
      const labelWidth = labels.getBBox().width
      // right-align the whole pill on x when asked, which is what a key placed
      // against the frame's right edge needs: its width is only known here
      const width = padX * 2 + swatch + gap + labelWidth
      const height = padY * 2 + a.entries.length * rowHeight
      const left = a.textAlign === 'end' ? cx - width : cx
      const top = cy
      const rect = document.createElementNS(NS, 'rect')
      rect.setAttribute('x', String(left))
      rect.setAttribute('y', String(top))
      rect.setAttribute('width', String(width))
      rect.setAttribute('height', String(height))
      rect.setAttribute('rx', '6')
      rect.setAttribute('fill', '#fff')
      rect.setAttribute('stroke', color)
      rect.setAttribute('stroke-width', '3')
      group.prepend(rect)
      for (const [i, entry] of a.entries.entries()) {
        const sw = document.createElementNS(NS, 'rect')
        sw.setAttribute('x', String(left + padX))
        sw.setAttribute(
          'y',
          String(top + padY + i * rowHeight + (rowHeight - swatch) / 2),
        )
        sw.setAttribute('width', String(swatch))
        sw.setAttribute('height', String(swatch))
        sw.setAttribute('rx', '3')
        sw.setAttribute('fill', entry.color)
        sw.setAttribute('stroke', '#0006')
        sw.setAttribute('stroke-width', '1')
        group.append(sw)
      }
      labels.setAttribute(
        'transform',
        `translate(${left + padX + swatch + gap},${top + padY})`,
      )
      // the labels were appended before the swatches so getBBox measured them
      // in isolation; move them back on top so nothing overlaps a swatch
      group.append(labels)
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
      text.setAttribute('text-anchor', a.textAlign === 'end' ? 'end' : 'start')
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
      const width = bbox.width + padX * 2
      const height = bbox.height + padY * 2
      let left = bbox.x - padX
      let top = bbox.y - padY
      // A leader pill is placed by its PILL rather than by its text baseline:
      // the facing edge lands on (cx, cy) and the other side of it follows from
      // whatever the label measured. That is what lets `dx` mean the same gap
      // for every callout in a figure, and it is the same measurement the arrow
      // below leaves from — so the two cannot part company.
      //
      // Moved by a transform rather than by rewriting every tspan's x: getBBox
      // reports the element's own user space, so the numbers above stay the ones
      // that were measured.
      if (a.leader && a.target) {
        const wantLeft = a.target.x > cx ? cx - width : cx
        const wantTop = cy - height / 2
        text.setAttribute(
          'transform',
          `translate(${wantLeft - left},${wantTop - top})`,
        )
        left = wantLeft
        top = wantTop
      }
      const rect = document.createElementNS(NS, 'rect')
      rect.setAttribute('x', String(left))
      rect.setAttribute('y', String(top))
      rect.setAttribute('width', String(width))
      rect.setAttribute('height', String(height))
      rect.setAttribute('rx', '6')
      rect.setAttribute('fill', '#fff')
      rect.setAttribute('stroke', a.color ?? '#e3242b')
      rect.setAttribute('stroke-width', '3')
      text.before(rect)
      if (a.leader) {
        // Both failures are silent otherwise — the pill draws, the arrow does
        // not, and only a committed PNG says so.
        const line = a.target
          ? leaderArrow(
              { left, top, width, height },
              a.target,
              color,
              a.strokeWidth ?? 4,
            )
          : undefined
        if (line) {
          // under its own pill, so a label that ends up closer than planned
          // reads as a short arrow rather than as a line drawn over white
          rect.before(line)
        } else {
          misses.push(
            JSON.stringify({
              leader: a.target
                ? 'the label sits on what it names — raise dx'
                : 'a leader needs an anchor to point back at',
              text: a.text,
              anchor: a.anchor,
            }),
          )
        }
      }
    }
    reportIfOffFrame(a, drawnFrom)
  }
  return { unresolved: misses, offFrame }
}
