import type { CigarUploadData } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface InsertionRegionFields {
  insertionPositions: Uint32Array
  insertionYs: Uint16Array
  insertionLengths: Uint16Array
  insertionFrequencies: Uint8Array
  numInsertions: number
}

// Slices the merged interbase array's insertion segment (first numInsertions
// entries). subarray() preserves the underlying buffer — no copy.
export function buildInsertionFields(
  data: CigarUploadData,
): InsertionRegionFields {
  const insEnd = data.numInsertions
  return {
    insertionPositions: data.interbasePositions.subarray(0, insEnd),
    insertionYs: data.interbaseYs.subarray(0, insEnd),
    insertionLengths: data.interbaseLengths.subarray(0, insEnd),
    insertionFrequencies: data.interbaseFrequencies.subarray(0, insEnd),
    numInsertions: data.numInsertions,
  }
}

export function emptyInsertionFields(): InsertionRegionFields {
  return {
    insertionPositions: new Uint32Array(0),
    insertionYs: new Uint16Array(0),
    insertionLengths: new Uint16Array(0),
    insertionFrequencies: new Uint8Array(0),
    numInsertions: 0,
  }
}
