import type { CigarHitResult } from '../../shared/hitTestTypes.ts'

export function emitDeletionHit(
  refPos: number,
  len: number,
  items: CigarHitResult[],
) {
  items.push({
    type: 'deletion',
    refPosition: refPos,
    length: len,
  })
}
