import { getClip, getLengthOnRef } from '@jbrowse/cigar-utils'

import { baseWorkerPileupData } from '../RenderAlignmentDataRPC/testPileupData.ts'
import { computeReadChains } from '../features/arcs/arcChains.ts'
import { namesToBlock } from '../shared/readNameBlock.ts'

import type { WorkerPileupData } from '../RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from '../features/arcs/arcTypes.ts'

/**
 * One alignment record as `samtools view` prints it, reduced to the columns the
 * connection and chaining code actually consults. Lets a test be built out of
 * real records copied from a real file rather than out of invented numbers: see
 * the `realReads.*.test.ts` fixtures, which carry the samtools command that
 * produced them.
 *
 * `strand` is carried rather than derived from `flag`, because converting the
 * reverse flag to a strand is the adapter's job and no other layer is allowed
 * to redo it (see the plugin's CLAUDE.md).
 */
export interface SamRecordFixture {
  name: string
  flag: number
  strand: number
  /** 1-based POS, exactly as the record spells it. */
  pos: number
  CIGAR: string
  /** SA tag value, `''` when the record carries none. */
  SA: string
}

/**
 * The fetch result those records would arrive as. The alignment span and the
 * read-order sort key are derived here by the same `getLengthOnRef` / `getClip`
 * calls `extractFeatureArrays` makes in the worker, so a fixture pins the
 * clip-frame convention instead of assuming one.
 */
export function pileupDataFromSamRecords(
  records: SamRecordFixture[],
): WorkerPileupData {
  const n = records.length
  const readPositions = new Uint32Array(n * 2)
  const readFlags = new Uint16Array(n)
  const readStrands = new Int8Array(n)
  const readClipAtStart = new Uint32Array(n)
  for (const [i, rec] of records.entries()) {
    const start = rec.pos - 1
    readPositions[i * 2] = start
    readPositions[i * 2 + 1] = start + getLengthOnRef(rec.CIGAR)
    readFlags[i] = rec.flag
    readStrands[i] = rec.strand
    readClipAtStart[i] = getClip(rec.CIGAR, rec.strand)
  }
  return {
    ...baseWorkerPileupData(0),
    readPositions,
    readFlags,
    readStrands,
    readClipAtStart,
    // ids are per-record and distinct; names are the QNAME, which split
    // segments of one read share and which is what groups them
    readKeys: records.map((_, i) => `id${i}`),
    readIdPrefix: undefined,
    ...namesToBlock(records.map(rec => rec.name)),
    readSuppAlignments: records.map(rec => rec.SA),
  }
}

/** The split-read chains those records form when fetched for one region. */
export function chainsFromSamRecords(
  records: SamRecordFixture[],
  region: RegionInfo,
) {
  return computeReadChains(
    [new Map([[0, pileupDataFromSamRecords(records)]])],
    [region],
  )
}
