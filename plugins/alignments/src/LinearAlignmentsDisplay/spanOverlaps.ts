// Genomic-span overlap math shared by the two layouts that put more than one
// feature on a single pileup row: chain mode (a chain's reads share their
// chain's row) and collapsed-group mode (every feature of a group shares row 0).
// Position-only and pure, so it is unit-testable independent of
// PileupDataResult.

export interface Span {
  start: number
  end: number
}

// Intervals where spans on one shared row overlap. Sweeps spans in start order
// tracking the running max end; each span beginning before that end contributes
// its intersection with the already-covered region.
//
// The output is deliberately NOT deduplicated: a position covered by `d` spans
// appears in exactly `d - 1` emitted intervals. (Span `i` emits `p` iff span `i`
// covers `p` and some earlier span does too — and "earlier" is by start, so any
// span reaching past `p` with a smaller start covers it.) Callers wanting a flat
// "reads overlap here" mark run `mergeSpans` over the result; callers wanting
// depth feed it straight to the alpha-blended tint layer, where `d - 1` stacked
// tints darken monotonically with depth.
export function overlapIntervals(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const out: Span[] = []
  let runningMaxEnd = sorted[0]?.end ?? 0
  for (let i = 1; i < sorted.length; i++) {
    const { start, end } = sorted[i]!
    const overlapEnd = Math.min(end, runningMaxEnd)
    if (start < overlapEnd) {
      out.push({ start, end: overlapEnd })
    }
    runningMaxEnd = Math.max(runningMaxEnd, end)
  }
  return out
}

// Collapse a set of spans into their disjoint union, merging any that overlap or
// touch. Undoes the depth-stacking above for callers that want one uniform tint
// over "reads overlap here" rather than a darkness proportional to how many.
export function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const out: Span[] = []
  for (const span of sorted) {
    const last = out[out.length - 1]
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end)
    } else {
      out.push({ ...span })
    }
  }
  return out
}
