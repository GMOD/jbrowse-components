import type { CigarHitResult } from '../../shared/hitTestTypes.ts'

export function emitMismatchHit(
  refPos: number,
  len: number,
  queryBase: string | undefined,
  items: CigarHitResult[],
) {
  items.push({
    type: 'mismatch',
    refPosition: refPos,
    length: len,
    base: queryBase?.toUpperCase(),
  })
}
