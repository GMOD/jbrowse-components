/**
 * The end a feature's span occupies in bp: one base past the start for a
 * zero-length feature (an insertion, `start === end`), its own end otherwise.
 *
 * Interbase `[start, end)` is empty when the two are equal, so a bare
 * containment test answers "nothing here" over a block both painters DO draw.
 * Two predicates were fixed for that a week apart, which is why the rule lives
 * in one place now.
 *
 * Genomic bp only. A painter's pixel-space widening (MULTI_ROW_MIN_CELL_PX, the
 * shader's `extendToMinWidthX`) is the different rule about the smallest mark a
 * screen can show.
 */
export function featureSpanEndBp(start: number, end: number) {
  return Math.max(end, start + 1)
}

/**
 * Whether a genomic base falls inside a feature's span, counting a zero-length
 * feature as covering the base it is painted from.
 */
export function featureSpanContainsBp(start: number, end: number, bp: number) {
  return start <= bp && bp < featureSpanEndBp(start, end)
}
