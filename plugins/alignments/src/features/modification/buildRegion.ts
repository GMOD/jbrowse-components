import type { ModificationUploadData } from './types.ts'

// Empty TypedArrays must be allocated per-call: the worker transfers their
// underlying ArrayBuffers, which detaches them. Module-level singletons
// cause DataCloneError on the second RPC reply.

export interface ModificationRegionFields {
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint32Array
  numModifications: number
}

export function buildModificationFields(
  data: ModificationUploadData,
): ModificationRegionFields {
  return {
    modificationPositions: data.modificationPositions,
    modificationYs: data.modificationYs,
    modificationColors: data.modificationColors,
    numModifications: data.modificationPositions.length,
  }
}

export function emptyModificationFields(): ModificationRegionFields {
  return {
    modificationPositions: new Uint32Array(0),
    modificationYs: new Uint16Array(0),
    modificationColors: new Uint32Array(0),
    numModifications: 0,
  }
}
