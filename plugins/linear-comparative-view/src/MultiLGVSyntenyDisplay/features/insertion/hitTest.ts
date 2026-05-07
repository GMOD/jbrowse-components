import type { CigarHitResult } from '../../shared/hitTestTypes.ts'

export function emitInsertionHit(
  refPos: number,
  len: number,
  insertionSeq: string | undefined,
  items: CigarHitResult[],
) {
  items.push({
    type: 'insertion',
    refPosition: refPos,
    length: len,
    insertionSeq,
  })
}
