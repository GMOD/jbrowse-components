import type { ModificationUploadData } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

const EMPTY_U32 = new Uint32Array(0)
const EMPTY_U16 = new Uint16Array(0)

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
    modificationPositions: EMPTY_U32,
    modificationYs: EMPTY_U16,
    modificationColors: EMPTY_U32,
    numModifications: 0,
  }
}
