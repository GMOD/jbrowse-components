import { READ_MATE_UNPLACED } from '@jbrowse/alignments-core'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'

interface ReadAt {
  data: Pick<WorkerPileupData, 'readMapqs' | 'readCategoryBits'>
  readIdx: number
}

/**
 * Whether a record is placed: MAPQ above 0, 255 ("unavailable") counting
 * placed. A record at MAPQ 0 carries no evidence (ADR-229), so an
 * interchromosomal connection, the family the arcs floor against mismapping,
 * draws only between placed records, on the band and the connectors alike.
 */
export function isPlacedRead({ data, readIdx }: ReadAt) {
  return data.readMapqs[readIdx] !== 0
}

/** Whether a record's mate is placed, where its MQ tag says; placed without one. */
export function isMatePlacedRead({ data, readIdx }: ReadAt) {
  return (data.readCategoryBits[readIdx]! & READ_MATE_UNPLACED) === 0
}
