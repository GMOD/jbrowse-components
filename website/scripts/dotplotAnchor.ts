import type { ViewportRect } from './graphAnchor.ts'
import type { AnnotationAnchor } from './screenshot-specs.ts'
import type { Page } from 'puppeteer'

// A dotplot anchor's locus, with the bounds optional: a bare refName is the
// whole chromosome, resolved in page context against that axis's own
// displayedRegions. That is the unit a dotplot callout wants — an off-diagonal
// block is "this chromosome against that one", and the grid cell those two names
// make is exactly the box to draw around it.
interface AxisLocus {
  refName: string
  start?: number
  end?: number
}

// Where a DotplotView drew a pair of loci, in viewport CSS px.
//
// The LGV sibling of this is `getHighlightCoords`, which the overlay calls from
// page context (`annotationOverlay.ts`'s modelRect). A dotplot cannot be reached
// that way for the same reason a graph cannot: the plot is one canvas with no
// element per feature, so a callout on a block would be a raw viewport
// coordinate — correct only for the width, the assembly order and the zoom it
// was measured against, with nothing to say when one of those moved. This is the
// `graphAnchor.ts` treatment: resolve it out here, against the live model.
//
// Two axes, so an anchor names up to two loci. `hLocus` is the horizontal
// (`hview`) axis and `vLocus` the vertical one; either may be omitted, and the
// omitted axis spans the whole plot — which is what a callout on "this
// chromosome, whatever it pairs with" wants. Naming neither is not a dotplot
// anchor at all, and `annotations.ts` never routes one here.
//
// The vertical axis is INVERTED against the layout: a dotplot's origin is the
// bottom-left, so a base's screen y is `viewHeight - alongPx`, the same flip the
// model's own `pxToBp` round trip makes (`DotplotView/model.ts`, the rubberband
// region). Reading the layout offset straight through as y puts every callout on
// the wrong half of the plot, mirrored about the middle — which looks like a
// plausible position rather than like a bug.
//
// Returns undefined when the view, an axis, the canvas or a refName isn't there,
// so the caller fails the spec by name rather than parking a callout at (0,0).
export async function dotplotAnchorRect(
  page: Page,
  anchor: AnnotationAnchor,
): Promise<ViewportRect | undefined> {
  const path = Array.isArray(anchor.view) ? anchor.view : [anchor.view ?? 0]
  return page.evaluate(
    (viewPath: number[], h: AxisLocus | null, v: AxisLocus | null) => {
      // The structural slice of the live model this needs. Declared here rather
      // than imported because it is serialized into the page, and
      // `window.JBrowseSession` is untyped from a harness script.
      interface Axis {
        offsetPx: number
        displayedRegions: { refName: string; start: number; end: number }[]
        // a bare px offset into the concatenated regions, NOT the `{ index,
        // offsetPx }` the underlying `bpToPx` util returns and not the
        // `{ left, width }` an LGV's getHighlightCoords does — Base1DView's
        // view method unwraps it. Reading `.offsetPx` off it is `undefined`,
        // which Math.min turns into NaN, which JSON-serializes as null and
        // lands the callout in the top-left corner rather than failing.
        bpToPx: (args: { refName: string; coord: number }) => number | undefined
      }
      interface DotplotView {
        id: string
        views?: DotplotView[]
        hview?: Axis
        vview?: Axis
      }
      let view = (window as unknown as { JBrowseSession?: DotplotView })
        .JBrowseSession
      for (const i of viewPath) {
        view = view?.views?.[i]
      }
      const hview = view?.hview
      const vview = view?.vview
      if (!view || !hview || !vview) {
        return undefined
      }
      // The canvas IS the plot area — it is styled to viewWidth/viewHeight, i.e.
      // the frame less the two axis borders — so its own rect is the box the
      // layout offsets below are measured in, and the borders need no arithmetic
      // here. The testid carries a `_done` suffix once the view settles, hence
      // the prefix match. Scoped to the view container when there is one, so a
      // page with two dotplots anchors against the one the spec named.
      const canvas =
        document.querySelector(
          `[data-testid="view-container-${CSS.escape(view.id)}"] [data-testid^="dotplot_webgl_canvas"]`,
        ) ?? document.querySelector('[data-testid^="dotplot_webgl_canvas"]')
      if (!canvas) {
        return undefined
      }
      const r = canvas.getBoundingClientRect()
      // A locus as screen px along one axis, low first. A bare refName takes the
      // whole displayed region of that name; a reversed axis puts `end` left of
      // `start`, so neither this nor its caller can assume an order.
      function span(axis: Axis, locus: AxisLocus) {
        const whole = axis.displayedRegions.find(
          reg => reg.refName === locus.refName,
        )
        const start = locus.start ?? whole?.start
        const end = locus.end ?? whole?.end
        if (start === undefined || end === undefined) {
          return undefined
        }
        const a = axis.bpToPx({ refName: locus.refName, coord: start })
        const b = axis.bpToPx({ refName: locus.refName, coord: end })
        return a === undefined || b === undefined
          ? undefined
          : {
              lo: Math.min(a, b) - axis.offsetPx,
              hi: Math.max(a, b) - axis.offsetPx,
            }
      }
      const hs = h ? span(hview, h) : { lo: 0, hi: r.width }
      const vs = v ? span(vview, v) : { lo: 0, hi: r.height }
      if (!hs || !vs) {
        return undefined
      }
      return {
        left: r.left + hs.lo,
        width: hs.hi - hs.lo,
        // the flip: an axis's HIGH coordinate is the plot's TOP edge
        top: r.top + r.height - vs.hi,
        height: vs.hi - vs.lo,
      }
    },
    path,
    anchor.hLocus ? parseAxisLocus(anchor.hLocus) : null,
    anchor.vLocus ? parseAxisLocus(anchor.vLocus) : null,
  )
}

// `4A`, `4A:1-5,000,000` or `4A:2,500,000`. Deliberately not
// `parseAnnotationLocus`, which requires the coordinates: on a dotplot the
// common case is a whole chromosome, and spelling that as `4A:1-830000000`
// would put an assembly's chromosome lengths into a spec, where they would be
// wrong the next time the assembly moved.
function parseAxisLocus(locus: string): AxisLocus {
  const cleaned = locus.replaceAll(/[\s,]/g, '')
  const idx = cleaned.lastIndexOf(':')
  if (idx === -1) {
    return { refName: cleaned }
  }
  const match = /^(\d+)(?:\.\.|-)?(\d+)?$/.exec(cleaned.slice(idx + 1))
  if (!match) {
    throw new Error(
      `dotplot anchor locus "${locus}" is not <refName>[:<start>[-<end>]]`,
    )
  }
  const start = Number(match[1]) - 1
  return {
    refName: cleaned.slice(0, idx),
    start,
    end: match[2] ? Number(match[2]) : start,
  }
}
