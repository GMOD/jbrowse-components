import { hasSymbolicAlt } from './sortCoordinate.ts'

import type { CandidateId } from './types.ts'

/**
 * The key a decision is stored under, so it must survive a reload, a refetch
 * and a change of adapter. Never `feature.id()`, which is adapter-internal and
 * moves with file offsets.
 *
 * `<assembly>:<refName>:<POS>:<REF>:<ALT,…>`, with `:<END>` appended when any
 * ALT is symbolic — two `<DEL>`s at one POS with different ENDs are different
 * calls. POS is the 1-based VCF POS, `end0` is 0-based exclusive (equal to the
 * 1-based inclusive END), alleles are upper-cased.
 */
export function candidateId({
  assemblyName,
  refName,
  pos1,
  ref,
  alts,
  end0,
}: {
  assemblyName: string
  refName: string
  pos1: number
  ref: string
  alts: readonly string[]
  end0: number
}): CandidateId {
  const base = [
    assemblyName,
    refName,
    pos1,
    ref.toUpperCase(),
    alts.map(a => a.toUpperCase()).join(','),
  ].join(':')
  return hasSymbolicAlt(alts) ? `${base}:${end0}` : base
}

/**
 * Suffix true duplicate records `#2`, `#3`, … in the order given (file order),
 * so every candidate keeps a distinct key. Returns how many were suffixed, for
 * the caller to warn about once.
 */
export function dedupeCandidateIds<T extends { id: CandidateId }>(
  records: T[],
) {
  const seen = new Map<CandidateId, number>()
  let duplicates = 0
  for (const r of records) {
    const n = (seen.get(r.id) ?? 0) + 1
    seen.set(r.id, n)
    if (n > 1) {
      duplicates++
      r.id = `${r.id}#${n}`
    }
  }
  return duplicates
}
