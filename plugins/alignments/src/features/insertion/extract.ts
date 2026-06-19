import type { InsertionData } from '../../shared/webglRpcTypes.ts'

export function emitInsertion(
  start: number,
  insertlen: number,
  insertedBases: string,
  featureId: string,
  featureStart: number,
  insertionsData: InsertionData[],
) {
  insertionsData.push({
    featureId,
    position: featureStart + start,
    length: insertlen,
    sequence: insertedBases,
  })
}
