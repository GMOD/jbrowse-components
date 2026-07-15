import type { InsertionData } from '../../shared/webglRpcTypes.ts'

export function emitInsertion(
  start: number,
  insertlen: number,
  insertedBases: string,
  readIndex: number,
  featureStart: number,
  insertionsData: InsertionData[],
) {
  insertionsData.push({
    readIndex,
    position: featureStart + start,
    length: insertlen,
    sequence: insertedBases,
  })
}
