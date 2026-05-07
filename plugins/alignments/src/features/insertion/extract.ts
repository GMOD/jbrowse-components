import type { Mismatch } from '../../shared/types.ts'
import type { InsertionData } from '../../shared/webglRpcTypes.ts'

export function emitInsertion(
  mm: Extract<Mismatch, { type: 'insertion' }>,
  featureId: string,
  featureStart: number,
  insertionsData: InsertionData[],
) {
  insertionsData.push({
    featureId,
    position: featureStart + mm.start,
    length: mm.insertlen,
    sequence: mm.insertedBases,
  })
}
