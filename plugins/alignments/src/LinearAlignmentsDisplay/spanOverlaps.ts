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
// "reads overlap here" mark run `mergeSortedSpans` over the result; callers wanting
// depth feed it straight to the alpha-blended tint layer, where `d - 1` stacked
// tints darken monotonically with depth.
export function overlapIntervals(spans: Span[]): Span[] {
  const positions = new Uint32Array(spans.length * 2)
  for (const [i, { start, end }] of spans.entries()) {
    positions[i * 2] = start
    positions[i * 2 + 1] = end
  }
  const packed = packedOverlapIntervals(positions, spans.length)
  return Array.from({ length: packed.length / 2 }, (_, i) => ({
    start: packed[i * 2]!,
    end: packed[i * 2 + 1]!,
  }))
}

// The same sweep on the packed `[start, end]` pairs `segmentPositions` already
// ships, so a collapsed relayout allocates no `Span` per segment. Sorting an
// index array leaves the caller's own array untouched, and the index tiebreak
// keeps ties on `start` in input order. Output is packed the same way, in start
// order and NOT deduplicated.
export function packedOverlapIntervals(
  positions: Uint32Array,
  numSpans: number,
) {
  const order = Uint32Array.from({ length: numSpans }, (_, i) => i)
  order.sort((a, b) => positions[a * 2]! - positions[b * 2]! || a - b)
  const out = new Uint32Array(Math.max(0, numSpans - 1) * 2)
  let count = 0
  let runningMaxEnd = numSpans > 0 ? positions[order[0]! * 2 + 1]! : 0
  for (let i = 1; i < numSpans; i++) {
    const at = order[i]! * 2
    const start = positions[at]!
    const end = positions[at + 1]!
    const overlapEnd = Math.min(end, runningMaxEnd)
    if (start < overlapEnd) {
      out[count * 2] = start
      out[count * 2 + 1] = overlapEnd
      count++
    }
    runningMaxEnd = Math.max(runningMaxEnd, end)
  }
  return count * 2 === out.length ? out : out.slice(0, count * 2)
}

// Collapse spans already in start order (as `overlapIntervals` emits them) into
// their disjoint union, merging any that overlap or touch.
export function mergeSortedSpans(sorted: Span[]): Span[] {
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
