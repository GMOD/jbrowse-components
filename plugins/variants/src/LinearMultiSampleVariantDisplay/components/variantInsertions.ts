import { EMPTY_INSERTIONS } from '@jbrowse/alignments-core'
import { pxPerBpOf } from '@jbrowse/render-core/canvas2dUtils'

import { cellCanDrawMarker } from './variantCellSpan.ts'

import type { VariantRenderBlock } from './variantRenderingBackendTypes.ts'
import type { InsertionChannels } from '@jbrowse/alignments-core'

/** The per-region fields the insertion channels read. */
export interface VariantInsertionData {
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellAltDosage: Uint8Array
  cellFeatureIndices: Uint32Array
  featurePositions: Uint32Array
  featureInsertedBp: Int32Array
  numCells: number
  // Where the non-reference bucket starts. Only alt-carrying cells widen, and
  // `isAlt` implies `!isReference` (see computeVariantCells' addCell), so every
  // cell that can carry a marker lives at or after this index.
  refCellCount: number
}

/**
 * One insertion-mark instance per alt-carrying cell of a record that inserts
 * sequence: the record's reference span, the cell's row and color, and the
 * inserted bp. Widening a reference or no-call cell would claim that haplotype
 * has the sequence, so those carry none. The marker is the cell's own color,
 * widened: "this is an insertion" is its shape and width alone.
 */
export function variantInsertionChannels(
  region: VariantInsertionData,
): InsertionChannels {
  const {
    cellRowIndices,
    cellColors,
    cellAltDosage,
    cellFeatureIndices,
    featurePositions,
    featureInsertedBp,
    numCells,
    refCellCount,
  } = region
  let count = 0
  for (let i = refCellCount; i < numCells; i++) {
    if (cellAltDosage[i] && featureInsertedBp[cellFeatureIndices[i]!]! > 0) {
      count++
    }
  }
  if (count === 0) {
    return EMPTY_INSERTIONS
  }
  const x = new Uint32Array(count)
  const x2 = new Uint32Array(count)
  const row = new Uint32Array(count)
  const length = new Uint32Array(count)
  const color = new Uint32Array(count)
  let o = 0
  for (let i = refCellCount; i < numCells; i++) {
    const f = cellFeatureIndices[i]!
    const inserted = featureInsertedBp[f]!
    if (cellAltDosage[i] && inserted > 0) {
      x[o] = featurePositions[f * 2]!
      x2[o] = featurePositions[f * 2 + 1]!
      row[o] = cellRowIndices[i]!
      length[o] = inserted
      color[o] = cellColors[i]!
      o++
    }
  }
  return { x, x2, row, length, color, count }
}

/**
 * Whether any record in this block draws an insertion marker: the legend's
 * question, asked with the mark's own gate. Walks `featurePositions`
 * (thousands) rather than the cells (features × samples), since every cell of
 * one variant shares its span and its inserted bp.
 */
export function anyMarkerPossibleForBlock(
  region: VariantInsertionData,
  block: VariantRenderBlock,
  drawnRowHeight: number,
) {
  const pxPerBp = pxPerBpOf(block)
  const numFeatures = region.featureInsertedBp.length
  for (let f = 0; f < numFeatures; f++) {
    const spanBp =
      region.featurePositions[f * 2 + 1]! - region.featurePositions[f * 2]!
    if (
      cellCanDrawMarker({
        spanPx: spanBp * pxPerBp,
        insertedBp: region.featureInsertedBp[f]!,
        pxPerBp,
        drawnRowHeight,
      })
    ) {
      return true
    }
  }
  return false
}
