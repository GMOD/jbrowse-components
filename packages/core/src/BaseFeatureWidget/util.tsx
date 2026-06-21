import type { SerializedFeat } from './types.tsx'

export interface Feat {
  start: number
  end: number
  type?: string
  name?: string
  id?: string | number
  phase?: number
}
export interface ParentFeat extends Feat {
  uniqueId: string
  strand?: number
  refName: string
  subfeatures?: Feat[]
  parentId?: string
}
export interface SeqState {
  seq: string
  upstream?: string
  downstream?: string
}

export interface ErrorState {
  error: string
}

// filter items if they have the same "ID" or location
function getItemId(feat: Feat) {
  return `${feat.start}-${feat.end}`
}

// filters if successive elements share same start/end
export function filterSuccessiveElementsWithSameStartAndEndCoord(list: Feat[]) {
  return list.filter(
    (item, pos, ary) => !pos || getItemId(item) !== getItemId(ary[pos - 1]!),
  )
}

export function calculateUTRs(cds: Feat[], exons: Feat[]) {
  // checking length ensures the .at below are valid
  if (!cds.length) {
    return []
  }
  if (exons.length < cds.length) {
    console.warn(
      'exons.length less than cds.length, cant calculate UTR properly',
      { exons, cds },
    )
    return []
  }

  const firstCds = cds.at(0)!

  const lastCds = cds.at(-1)!
  const firstCdsIdx = exons.findIndex(
    exon => exon.end >= firstCds.start && exon.start <= firstCds.start,
  )
  const lastCdsIdx = exons.findIndex(
    exon => exon.end >= lastCds.end && exon.start <= lastCds.end,
  )
  const lastCdsExon = exons[lastCdsIdx]!
  const firstCdsExon = exons[firstCdsIdx]!

  const fivePrimeUTRs = [
    ...exons.slice(0, firstCdsIdx),
    {
      start: firstCdsExon.start,
      end: firstCds.start,
    },
  ].map(elt => ({
    ...elt,
    type: 'five_prime_UTR',
  }))

  const threePrimeUTRs = [
    {
      start: lastCds.end,
      end: lastCdsExon.end,
    },
    ...exons.slice(lastCdsIdx + 1),
  ].map(elt => ({
    ...elt,
    type: 'three_prime_UTR',
  }))

  return [...fivePrimeUTRs, ...threePrimeUTRs]
}

// calculates UTRs using impliedUTRs logic, but there are no exon subfeatures
export function calculateUTRs2(cds: Feat[], parentFeat: Feat) {
  if (!cds.length) {
    return []
  }

  const firstCds = cds.at(0)!
  const lastCds = cds.at(-1)!
  return [
    { start: parentFeat.start, end: firstCds.start, type: 'five_prime_UTR' },
    { start: lastCds.end, end: parentFeat.end, type: 'three_prime_UTR' },
  ]
}

export function ellipses(slug: string) {
  return slug.length > 20 ? `${slug.slice(0, 20)}...` : slug
}

export function getStrandStr(strand: number | undefined) {
  return strand === -1 ? '(-)' : strand === 1 ? '(+)' : ''
}

// JSON only serializes null, not undefined; feature fields are hidden by a
// formatDetails callback returning undefined (jexl can't produce null), so when
// persisting we round-trip undefined to null to keep the field hidden after
// reload (detail components filter with `!= null`). see config guide.
export const nullReplacer = (_: string, v: unknown) =>
  v === undefined ? null : v

export function formatSubfeatures(
  obj: SerializedFeat,
  depth: number,
  parse: (obj: Record<string, unknown>) => void,
  currentDepth = 0,
) {
  if (depth <= currentDepth) {
    return
  }
  for (const sub of obj.subfeatures ?? []) {
    formatSubfeatures(sub, depth, parse, currentDepth + 1)
    parse(sub)
  }
}
