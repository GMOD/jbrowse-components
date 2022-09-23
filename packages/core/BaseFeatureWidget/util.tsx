export interface Feat {
  start: number
  end: number
  type: string
  name?: string
  id?: string
}
export interface ParentFeat extends Feat {
  strand?: number
  subfeatures?: Feat[]
}
export interface SeqState {
  seq: string
  upstream?: string
  downstream?: string
}
export function stitch(subfeats: Feat[], sequence: string) {
  return subfeats.map(sub => sequence.slice(sub.start, sub.end)).join('')
}

// filter items if they have the same "ID" or location
function getItemId(feat: Feat) {
  return `${feat.start}-${feat.end}`
}

// filters if successive elements share same start/end
export function dedupe(list: Feat[]) {
  return list.filter(
    (item, pos, ary) => !pos || getItemId(item) !== getItemId(ary[pos - 1]),
  )
}

export function revlist(list: Feat[], seqlen: number) {
  return list
    .map(sub => ({
      ...sub,
      start: seqlen - sub.end,
      end: seqlen - sub.start,
    }))
    .sort((a, b) => a.start - b.start)
}

// calculates UTRs using impliedUTRs logic
export function calculateUTRs(cds: Feat[], exons: Feat[]) {
  const firstCds = cds[0]
  const lastCds = cds[cds.length - 1]
  const firstCdsIdx = exons.findIndex(
    exon => exon.end >= firstCds.start && exon.start <= firstCds.start,
  )
  const lastCdsIdx = exons.findIndex(
    exon => exon.end >= lastCds.end && exon.start <= lastCds.end,
  )
  const lastCdsExon = exons[lastCdsIdx]
  const firstCdsExon = exons[firstCdsIdx]

  const fiveUTRs = [
    ...exons.slice(0, firstCdsIdx),
    { start: firstCdsExon.start, end: firstCds.start },
  ].map(elt => ({ ...elt, type: 'five_prime_UTR' }))

  const threeUTRs = [
    { start: lastCds.end, end: lastCdsExon.end },
    ...exons.slice(lastCdsIdx + 1),
  ].map(elt => ({ ...elt, type: 'three_prime_UTR' }))

  return [...fiveUTRs, ...threeUTRs]
}

export function ellipses(slug: string) {
  return slug.length > 20 ? `${slug.slice(0, 20)}...` : slug
}
