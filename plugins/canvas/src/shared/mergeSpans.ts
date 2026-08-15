// A half-open `[start, end)` interval. Unitless on purpose: the worker merges bp
// spans (transcriptCoords) and the main-thread packer merges px spans (layout),
// and the merge is the same operation in both.
export type Span = [start: number, end: number]

/**
 * Merge overlapping and TOUCHING spans into a disjoint set, ascending by start.
 *
 * `<=` rather than `<`, so spans that merely abut join instead of staying two.
 * Both callers depend on that: the CDS and UTR halves of one exon abut exactly
 * and are one exonic piece, and two abutting solid features are one stretch the
 * density collapse must not pin a mark into.
 *
 * Does not mutate the input — it sorts a copy — because both callers pass a list
 * they go on to use in its original order.
 *
 * Deliberately NOT core's `mergeIntervals`, which answers the same question over
 * `{start, end}` OBJECTS with a padding argument and carries each interval's
 * other fields through. Both callers here have nothing but the pair and are on
 * hot paths — the px merge runs once per ref-group per pack, and the fit solve
 * packs a ref-group ~10 times — so routing them through it would box and clone
 * every span to keep fields neither of them has. Use core's wherever the
 * intervals are features; this is the primitive twin, not a second opinion.
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
