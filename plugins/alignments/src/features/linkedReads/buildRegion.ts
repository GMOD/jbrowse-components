import type { LinkedReadLinesUploadData } from './types.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface LinkedReadLinesRegionFields {
  linkedReadLinePositions: Uint32Array
  linkedReadLineYs: Uint16Array
  linkedReadLineColorTypes: Uint8Array
  numLinkedReadLines: number
}

export function buildLinkedReadLinesFields(
  data: LinkedReadLinesUploadData,
): LinkedReadLinesRegionFields {
  return {
    linkedReadLinePositions: data.linkedReadLinePositions,
    linkedReadLineYs: data.linkedReadLineYs,
    linkedReadLineColorTypes: data.linkedReadLineColorTypes,
    numLinkedReadLines: data.numLinkedReadLines,
  }
}

export function emptyLinkedReadLinesFields(): LinkedReadLinesRegionFields {
  return {
    linkedReadLinePositions: new Uint32Array(0),
    linkedReadLineYs: new Uint16Array(0),
    linkedReadLineColorTypes: new Uint8Array(0),
    numLinkedReadLines: 0,
  }
}
