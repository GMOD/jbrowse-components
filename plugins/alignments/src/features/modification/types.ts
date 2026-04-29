// Worker → main-thread payload for modification entries.
// Owned by the modification feature; consumed by packGpu / buildRegion.
export interface ModificationUploadData {
  modificationPositions: Uint32Array
  modificationYs: Uint16Array
  modificationColors: Uint32Array
}
