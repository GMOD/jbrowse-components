import type { InsertionData } from '../../shared/webglRpcTypes.ts'
import type { Mismatch } from '@jbrowse/alignments-core'

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
