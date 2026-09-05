/**
 * One base past the start for a zero-length feature, its own end otherwise:
 * interbase `[start, end)` is empty when the two are equal, so a bare
 * containment test answers "nothing here" over a block both painters draw.
 * Genomic bp only — a painter's pixel-space widening is a different rule.
 */
export function featureSpanEndBp(start: number, end: number) {
  return Math.max(end, start + 1)
}

/**
 * Counts a zero-length feature as covering the base it is painted from.
 */
export function featureSpanContainsBp(start: number, end: number, bp: number) {
  return start <= bp && bp < featureSpanEndBp(start, end)
}
