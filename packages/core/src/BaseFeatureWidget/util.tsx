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
