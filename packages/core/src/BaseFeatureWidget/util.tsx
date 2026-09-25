export interface Feat {
  start: number
  end: number
  type?: string
  name?: string
  id?: string | number
  phase?: number
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

export function ellipses(slug: string) {
  return slug.length > 20 ? `${slug.slice(0, 20)}...` : slug
}

export function getStrandStr(strand: number | undefined) {
  return strand === -1 ? '(-)' : strand === 1 ? '(+)' : ''
}
