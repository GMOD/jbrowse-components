import { buildReadIdToIndex } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

// The read trunk owns the per-read fields every CIGAR/coverage/highlight
// path reads from. Lives at the trunk because chain overlays, hit-tests,
// and read coloring all walk these arrays — they're not a leaf-feature
// concern.

export interface ReadRegionFields {
  readIdToIndex: Map<string, number>
  readPositions: Uint32Array
  readYs: Uint16Array
  readFlags: Uint16Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint32Array
  readChainHasSupp: Uint8Array | undefined
  numReads: number
  insertSizeStats?: { upper: number; lower: number }
}

export function buildReadFields(data: PileupDataResult): ReadRegionFields {
  const numReads = data.readIds.length
  return {
    readIdToIndex: buildReadIdToIndex(data.readIds, numReads),
    readPositions: data.readPositions,
    readYs: data.readYs,
    readFlags: data.readFlags,
    readMapqs: data.readMapqs,
    readAvgBaseQualities: data.readAvgBaseQualities,
    readInsertSizes: data.readInsertSizes,
    readPairOrientations: data.readPairOrientations,
    readStrands: data.readStrands,
    readTagColors: data.readTagColors,
    readChainHasSupp: data.readChainHasSupp,
    numReads,
    insertSizeStats: data.insertSizeStats,
  }
}

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.
export function emptyReadFields(): ReadRegionFields {
  return {
    readIdToIndex: new Map(),
    readPositions: new Uint32Array(0),
    readYs: new Uint16Array(0),
    readFlags: new Uint16Array(0),
    readMapqs: new Uint8Array(0),
    readAvgBaseQualities: new Uint8Array(0),
    readInsertSizes: new Float32Array(0),
    readPairOrientations: new Uint8Array(0),
    readStrands: new Int8Array(0),
    readTagColors: new Uint32Array(0),
    readChainHasSupp: undefined,
    numReads: 0,
    insertSizeStats: undefined,
  }
}
