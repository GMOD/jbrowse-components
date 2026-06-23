import { buildReadIdToIndex } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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
  readInsertSizes: Float32Array
  readPairOrientations: Uint8Array
  readStrands: Int8Array
  readTagColors: Uint32Array
  readChainHasSupp: Uint8Array | undefined
  readInterchrom: Uint8Array
  insertSizeStats?: { upper: number; lower: number }
  // Per-exon segments (reads split at CIGAR N/skip). The Canvas2D/SVG read
  // draw walks these — not whole reads — so intron spans are never filled and
  // the skip pass needs no clearRect, matching the GPU's per-segment quads.
  segmentPositions: Uint32Array
  segmentReadIndices: Uint32Array
  segmentEdgeFlags: Uint8Array
}

export function buildReadFields(data: PileupDataResult): ReadRegionFields {
  return {
    readIdToIndex: buildReadIdToIndex(data.readIds, data.readIds.length),
    readPositions: data.readPositions,
    readYs: data.readYs,
    readFlags: data.readFlags,
    readMapqs: data.readMapqs,
    readInsertSizes: data.readInsertSizes,
    readPairOrientations: data.readPairOrientations,
    readStrands: data.readStrands,
    readTagColors: data.readTagColors,
    readChainHasSupp: data.readChainHasSupp,
    readInterchrom: data.readInterchrom,
    insertSizeStats: data.insertSizeStats,
    segmentPositions: data.segmentPositions,
    segmentReadIndices: data.segmentReadIndices,
    segmentEdgeFlags: data.segmentEdgeFlags,
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
    readInsertSizes: new Float32Array(0),
    readPairOrientations: new Uint8Array(0),
    readStrands: new Int8Array(0),
    readTagColors: new Uint32Array(0),
    readChainHasSupp: undefined,
    readInterchrom: new Uint8Array(0),
    insertSizeStats: undefined,
    segmentPositions: new Uint32Array(0),
    segmentReadIndices: new Uint32Array(0),
    segmentEdgeFlags: new Uint8Array(0),
  }
}
