/** A stretch of one chromosome and the chromosome its alignment joins it to. */
export interface PartnerSpan {
  partner: string
  start: number
  end: number
}

export interface PartnerShare {
  partner: string
  fraction: number
}

function coveredBp(spans: PartnerSpan[]) {
  spans.sort((a, b) => a.start - b.start)
  let covered = 0
  let reach = -Infinity
  for (const { start, end } of spans) {
    covered += Math.max(0, end - Math.max(start, reach))
    reach = Math.max(reach, end)
  }
  return covered
}

/**
 * What share of `region` each partner's alignments cover, most first.
 * Overlapping alignments to one partner count their bases once, and bases
 * past the region count none.
 */
export function partnerShares(
  spans: readonly PartnerSpan[],
  region: { start: number; end: number },
): PartnerShare[] {
  const clipped = spans.map(s => ({
    ...s,
    start: Math.max(s.start, region.start),
    end: Math.min(s.end, region.end),
  }))
  return [...Map.groupBy(clipped, s => s.partner)]
    .map(([partner, list]) => ({
      partner,
      fraction: coveredBp(list) / (region.end - region.start),
    }))
    .sort((a, b) => b.fraction - a.fraction)
}
