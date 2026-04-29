import type { MismatchUploadData } from './types.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface MismatchRegionFields {
  mismatchPositions: Uint32Array
  mismatchYs: Uint16Array
  mismatchBases: Uint8Array
  mismatchFrequencies: Uint8Array
  numMismatches: number
}

export function buildMismatchFields(
  data: MismatchUploadData,
): MismatchRegionFields {
  return {
    mismatchPositions: data.mismatchPositions,
    mismatchYs: data.mismatchYs,
    mismatchBases: data.mismatchBases,
    mismatchFrequencies: data.mismatchFrequencies,
    numMismatches: data.mismatchPositions.length,
  }
}

export function emptyMismatchFields(): MismatchRegionFields {
  return {
    mismatchPositions: new Uint32Array(0),
    mismatchYs: new Uint16Array(0),
    mismatchBases: new Uint8Array(0),
    mismatchFrequencies: new Uint8Array(0),
    numMismatches: 0,
  }
}
