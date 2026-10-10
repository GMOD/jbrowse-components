import type { CandidateVariant } from './types.ts'

/**
 * Genomic order: refName by its place in the assembly's regions (so `chr2`
 * comes before `chr10`), then start, end and id, as a new array. A refName
 * missing from `refOrder` sorts after every known one.
 */
export function orderCandidates(
  candidates: CandidateVariant[],
  refOrder: ReadonlyMap<string, number>,
) {
  const rank = (refName: string) =>
    refOrder.get(refName) ?? Number.MAX_SAFE_INTEGER
  return [...candidates].sort(
    (a, b) =>
      rank(a.refName) - rank(b.refName) ||
      a.refName.localeCompare(b.refName) ||
      a.start - b.start ||
      a.end - b.end ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )
}
