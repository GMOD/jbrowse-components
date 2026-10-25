/**
 * One base past the start for a zero-length feature, its own end otherwise:
 * interbase `[start, end)` is empty when the two are equal, so a bare
 * containment test answers "nothing here" over a block both painters draw.
 * Genomic bp only — a painter's pixel-space widening is a different rule.
 */
export function featureSpanEndBp(start: number, end: number) {
  return Math.max(end, start + 1)
}
