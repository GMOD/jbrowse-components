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
 * What share of a chromosome of `lengthBp` each partner's alignments cover,
 * most first. Overlapping alignments to one partner count their bases once.
 */
export function partnerShares(
  spans: readonly PartnerSpan[],
  lengthBp: number,
): PartnerShare[] {
  const byPartner = Map.groupBy(spans, s => s.partner)
  return [...byPartner]
    .map(([partner, list]) => ({
      partner,
      fraction: coveredBp([...list]) / lengthBp,
    }))
    .sort((a, b) => b.fraction - a.fraction)
}
