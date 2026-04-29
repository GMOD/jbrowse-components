import type { GapUploadData } from './types.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface GapRegionFields {
  gapPositions: Uint32Array
  gapYs: Uint16Array
  gapTypes: Uint8Array
  gapFrequencies: Uint8Array
  numGaps: number
}

export function buildGapFields(data: GapUploadData): GapRegionFields {
  return {
    gapPositions: data.gapPositions,
    gapYs: data.gapYs,
    gapTypes: data.gapTypes,
    gapFrequencies: data.gapFrequencies,
    numGaps: data.gapPositions.length / 2,
  }
}

export function emptyGapFields(): GapRegionFields {
  return {
    gapPositions: new Uint32Array(0),
    gapYs: new Uint16Array(0),
    gapTypes: new Uint8Array(0),
    gapFrequencies: new Uint8Array(0),
    numGaps: 0,
  }
}
