// A half-open `[start, end)` interval, unitless: the worker merges bp spans and
// the main-thread packer merges px spans.
export type Span = [start: number, end: number]

/**
 * Merges overlapping and touching spans into a disjoint set, ascending by
 * start. `<=` rather than `<` so spans that merely abut join: the CDS and UTR
 * halves of one exon abut exactly and are one exonic piece. Sorts a copy,
 * because both callers go on to use their list in its original order.
 */
export function mergeSpans(spans: readonly Span[]): Span[] {
  const merged: Span[] = []
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1)
    if (last && start <= last[1]) {
      last[1] = Math.max(last[1], end)
    } else {
      merged.push([start, end])
    }
  }
  return merged
}
