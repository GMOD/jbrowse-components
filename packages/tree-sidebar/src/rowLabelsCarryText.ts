/**
 * Below this a label's text is illegible, so the row draws as a color swatch
 * only. It is not a gate on drawing anything at all: a clustered track can sit
 * at a fraction of a pixel a row (1,987 canids in 640px is 0.32px) and the tint
 * is still the only thing carrying row identity there, so it has to survive.
 *
 * Prefer `rowLabelsCarryText` to the bare number — see there.
 */
export const MIN_TEXT_ROW_HEIGHT = 6

/**
 * Whether a row of this height draws its NAME rather than a bare color swatch.
 *
 * This is the one question, asked by the one function, in both places that need
 * it: `SvgRowLabels`, deciding what to draw, and a display deciding
 * whether it needs a color key beside the plot — because a key exists to name
 * colors, and while the rows name themselves it would only restate them.
 *
 * A predicate rather than the exported constant on purpose. The constant lets
 * each caller re-type the comparison, and re-typing it is how the answer drifts:
 * multi-wiggle's key asked `showTree && height >= MIN_TEXT_ROW_HEIGHT` for a
 * while, conflating the dendrogram with the labels, which draw whether or not a
 * tree does — so hiding the tree drew a key restating labels still on screen.
 * There is nothing to conflate with a call.
 */
export function rowLabelsCarryText(rowHeight: number) {
  return rowHeight >= MIN_TEXT_ROW_HEIGHT
}
