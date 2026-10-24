export interface DomainSpan {
  start: number
  end: number
}

export const MAX_DOMAIN_LANES = 3

// Greedy first-fit by start, longest first, so a domain nested in a larger one
// takes the next lane. Lanes past the cap share the last one.
export function assignDomainLanes(spans: DomainSpan[]) {
  const order = spans
    .map((span, i) => ({ ...span, i }))
    .toSorted((a, b) => a.start - b.start || b.end - a.end)
  const laneEnds: number[] = []
  const lanes = new Array<number>(spans.length)
  for (const { start, end, i } of order) {
    let lane = laneEnds.findIndex(laneEnd => laneEnd <= start)
    if (lane === -1) {
      lane = Math.min(laneEnds.length, MAX_DOMAIN_LANES - 1)
    }
    laneEnds[lane] = Math.max(laneEnds[lane] ?? 0, end)
    lanes[i] = lane
  }
  return { lanes, laneCount: laneEnds.length }
}
