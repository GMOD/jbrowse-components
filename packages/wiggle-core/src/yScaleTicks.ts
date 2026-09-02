import { YSCALEBAR_LABEL_OFFSET } from './constants.ts'

// Tick positions for a y-axis, in the same screen space the renderer paints in.
//
// **`yBottom` is the screen y at which the renderer paints domain-min**, `yTop`
// domain-max, and each item's `y` where it paints that item's value. A producer
// that doesn't agree with its own renderer there is a bug, not a rounding
// choice: the axis is what the reader believes, so a tick a pixel off its data
// reads as the data being wrong, and the crosshatch guide lines drawn at the
// same `y` are what they'd align against to check.
//
// Three producers feed this — `computeYTicks` (the wiggle family),
// `computeCoverageTicks` and `computeInsertSizeTicks` — against three different
// renderers, so the agreement is per producer and each one owns it. `computeInsertSizeTicks` states the
// same rule in its own words, and derives its geometry from the very functions
// the arcs are drawn with. Its down-anchored mode returns the pair reversed,
// `yTop` at domain-min, so a consumer wanting a span must take min and max.
//
// The half-pixel a 1px stroke needs to land crisply is the *drawing's*
// business, not this type's. Folding it into the values skews every tick to buy
// one line's alignment, which is exactly the bug `clampStrokeInsideAxis`
// replaced: `computeYTicks` shortened its range by a pixel so multi-wiggle's
// bottom spine would stay inside its row, and every tick above it inherited a
// fraction of that pixel.
export interface YScaleTicks {
  items: { value: number; y: number; label?: string }[]
  yTop: number
  yBottom: number
}

/**
 * The plot box a wiggle-family display insets inside its own height, for both
 * sides of the contract above: the renderer positions its canvas at `yTop` and
 * draws `plotHeight` tall, and the axis puts domain-max at `yTop` and
 * domain-min at `yBottom`.
 *
 * One function because the two have to agree exactly, and `height - 2 * offset`
 * spelled out at each end is how they stopped: `computeYTicks` derived its own
 * bottom as `height - offset - 1`, and every tick above it inherited a fraction
 * of that pixel.
 */
export function axisPlotBox(
  height: number,
  offset: number = YSCALEBAR_LABEL_OFFSET,
) {
  return {
    yTop: offset,
    yBottom: height - offset,
    plotHeight: height - 2 * offset,
  }
}

/**
 * Screen y for an already-normalized ([0,1], 0 at domain-min) score. The
 * composition of {@link axisPlotBox} with a `makeScoreNormalizer` result, which
 * is what a tick at that score must land on.
 */
export function scoreToAxisY(
  normalized: number,
  box: ReturnType<typeof axisPlotBox>,
) {
  return box.yTop + (1 - normalized) * box.plotHeight
}

/**
 * Width of the gutter a left-oriented {@link YScaleBar} is drawn in, and the x
 * inside that gutter its spine goes at.
 *
 * `YScaleBar` grows its ticks and numbers *away* from the spine, so a
 * left-oriented axis has to inset its spine by the label width or the labels
 * land at negative x — which is what once put an exported coverage axis off the
 * image entirely. Both numbers live here, beside the component whose own
 * geometry (`x = ±9`, `fontSize 10`, `textAnchor: end`) is what makes them the
 * right ones: the alignments coverage axis and the MAF band axes had each
 * arrived at this same 50/45 pair independently, so a change to the labels moved
 * neither.
 *
 * An axis drawn over its own plot rather than in reserved space may narrow the
 * gutter — every px of it is a px of data hidden. Such an axis still places its
 * spine at `width - 1`, the same rule stated against its own width.
 */
export const AXIS_GUTTER_WIDTH_PX = 50

export function leftAxisSpineX(gutterLeft = 0) {
  return gutterLeft + AXIS_GUTTER_WIDTH_PX - YSCALEBAR_LABEL_OFFSET
}

/**
 * Keep a 1px stroke's center inside the axis box. At `yBottom` — the box's own
 * bottom edge — the stroke has to cover the pixel *above* the boundary, since
 * the one below belongs to whatever is drawn next; in multi-wiggle, where rows
 * stack edge to edge, that is literally the next sample's first row of pixels.
 * Callers pass whatever stroke center their own convention gives (the axis
 * crispens to `y + 0.5`, the guide lines don't); only the bottom edge moves.
 */
export function clampStrokeInsideAxis(strokeY: number, yBottom: number) {
  return Math.min(strokeY, yBottom - 0.5)
}
