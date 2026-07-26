import {
  INTERBASE_HARDCLIP,
  INTERBASE_INSERTION,
  INTERBASE_SOFTCLIP,
} from './types.ts'

import type {
  HardclipData,
  InsertionData,
  SoftclipData,
} from './webglRpcTypes.ts'

interface InterbaseInput {
  readIndex: number
  position: number
  length: number
  sequence?: string
}

// Merges insertions + softclips + hardclips into a single typed-array set
// laid out as (insertions, softclips, hardclips). The renderer slices
// each subrange via `subarray` (no copy). Numeric type codes
// (1/2/3) match shader expectations and the indicator pass.
export function buildInterbaseArrays(
  insertions: InsertionData[],
  softclips: SoftclipData[],
  hardclips: HardclipData[],
  regionStart: number,
) {
  const filteredInsertions = insertions.filter(
    ins => ins.position >= regionStart,
  )
  const filteredSoftclips = softclips.filter(sc => sc.position >= regionStart)
  const filteredHardclips = hardclips.filter(hc => hc.position >= regionStart)

  const totalInterbases =
    filteredInsertions.length +
    filteredSoftclips.length +
    filteredHardclips.length

  const interbasePositions = new Uint32Array(totalInterbases)
  const interbaseYs = new Uint16Array(totalInterbases)
  // 32 bits because an insertion is not bounded by the read's reference span:
  // an assembly-to-reference BAM (dipcall, `minimap2 -a` on contigs, a pangenome
  // graph path) carries insertions of 100 kb and up, and the length here is what
  // both the on-screen label and the tooltip report. At 16 bits every one of
  // those read "65535". The GPU field is already u32 (packInsertions).
  const interbaseLengths = new Uint32Array(totalInterbases)
  const interbaseTypes = new Uint8Array(totalInterbases)
  const interbaseReadIndices = new Uint32Array(totalInterbases)
  const interbaseSequences: string[] = []

  let idx = 0
  function addItems(items: InterbaseInput[], type: number) {
    for (const item of items) {
      interbasePositions[idx] = item.position
      interbaseLengths[idx] = item.length
      interbaseTypes[idx] = type
      interbaseReadIndices[idx] = item.readIndex
      interbaseSequences.push(item.sequence ?? '')
      idx++
    }
  }

  addItems(filteredInsertions, INTERBASE_INSERTION)
  addItems(filteredSoftclips, INTERBASE_SOFTCLIP)
  addItems(filteredHardclips, INTERBASE_HARDCLIP)

  return {
    interbasePositions,
    interbaseYs,
    interbaseLengths,
    interbaseTypes,
    interbaseReadIndices,
    interbaseSequences,
    // Counts per type in the canonical layout (ins, then soft, then hard).
    // Lets consumers slice subranges directly without re-scanning types.
    numInsertions: filteredInsertions.length,
    numSoftclips: filteredSoftclips.length,
    numHardclips: filteredHardclips.length,
  }
}
