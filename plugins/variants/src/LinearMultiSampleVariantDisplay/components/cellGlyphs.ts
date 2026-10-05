import { shapeTypeOf } from './variantShape.ts'

import type { VariantFeatureInfo } from '../../shared/types.ts'

/** The `cell` mark's per-instance attributes, as `VariantUploadData` carries them. */
export interface CellGlyphs {
  // Absolute genomic uint32 (start, end) per cell; the shader hp-splits
  // against bpRangeX, so no region origin rides alongside.
  cellPositions: Uint32Array
  cellShapeTypes: Uint8Array
}

/**
 * Deal each record's span and glyph to its cells. The payload carries both
 * once per record, since every cell of a variant shares them, and the mark
 * reads one instance at a time, so this is the one place they repeat.
 */
export function cellGlyphs(data: {
  cellFeatureIndices: Uint32Array
  numCells: number
  featurePositions: Uint32Array
  featureInfo: VariantFeatureInfo[]
}): CellGlyphs {
  const { cellFeatureIndices, numCells, featurePositions, featureInfo } = data
  const shapeOf = new Uint8Array(featureInfo.length)
  for (let f = 0; f < featureInfo.length; f++) {
    shapeOf[f] = shapeTypeOf(featureInfo[f]!.type)
  }
  const cellPositions = new Uint32Array(numCells * 2)
  const cellShapeTypes = new Uint8Array(numCells)
  for (let i = 0; i < numCells; i++) {
    const f = cellFeatureIndices[i]!
    cellPositions[i * 2] = featurePositions[f * 2]!
    cellPositions[i * 2 + 1] = featurePositions[f * 2 + 1]!
    cellShapeTypes[i] = shapeOf[f]!
  }
  return { cellPositions, cellShapeTypes }
}
