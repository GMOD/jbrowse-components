import {
  MIN_HEIGHT_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
  insertionBarWidth,
} from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import type {
  VariantRenderBlock,
  VariantRenderState,
} from './variantRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const FONT = '10px sans-serif'

/**
 * The per-region fields this pass reads, declared structurally rather than as
 * `VariantCellData`: the main thread holds the *shipped* form, whose
 * `featureGenotypeMap` is interned to genotype codes before crossing the RPC
 * boundary. Both satisfy this.
 */
export interface VariantInsertionGlyphData {
  cellPositions: Uint32Array
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
  cellCarriesAlt: Uint8Array
  cellFeatureIndices: Uint32Array
  featureInsertedBp: Int32Array
  numCells: number
}

/**
 * Insertion markers over the genotype cells, sized by each record's inserted bp.
 *
 * `drawVariantBlocks` draws a cell across the reference span its record covers,
 * floored at 2px. That is correct for a SNP and for a deletion, and it is why the
 * regular (non-matrix) display reads well for structural variants: everything
 * sits at its true genomic position and width. An insertion is the exception,
 * because it consumes no reference: `wave.vcf.gz` carries ALTs up to 65,481 bp
 * that all land on the same 2px floor a SNP does. This pass is where that length
 * goes.
 *
 * Mirrors `drawVariantBlocks`' arguments and geometry (`forEachClippedBlock` +
 * `makeBpMapper`, the same 2px row floor, the same Y-cull) so a marker cannot
 * drift off the cell it widens, and uses `drawInsertionMarker` from
 * `@jbrowse/alignments-core` so the bar geometry stays identical to the pileup's
 * and MAF's.
 *
 * Two rules keep it honest. Only cells whose genotype carries a non-reference
 * allele widen (`cellCarriesAlt`), because widening a reference or no-call cell
 * would claim that haplotype has the sequence. And each marker keeps its cell's
 * own genotype color rather than the alignments insertion purple, since the color
 * is what says which allele the haplotype carries; the marker only supplies
 * length.
 *
 * Shared by the on-screen overlay and the SVG export.
 */
export function drawVariantInsertionGlyphs(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, VariantInsertionGlyphData>,
  blocks: VariantRenderBlock[],
  state: VariantRenderState,
) {
  const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state
  const drawnRowHeight = Math.max(rowHeight, 2)
  const labelFits = drawnRowHeight >= MIN_HEIGHT_FOR_TEXT
  ctx.font = FONT
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => {
      const region = regions.get(block.displayedRegionIndex)
      return region && region.numCells > 0 ? region : undefined
    },
    (region, block) => {
      const toX = makeBpMapper(block)
      const pxPerBp =
        (block.screenEndPx - block.screenStartPx) / (block.end - block.start)
      for (let i = 0; i < region.numCells; i++) {
        if (region.cellCarriesAlt[i]) {
          const inserted =
            region.featureInsertedBp[region.cellFeatureIndices[i]!]!
          // Y-cull before the bp math, as the block painter does
          const y = region.cellRowIndices[i]! * rowHeight - scrollTop
          if (
            inserted > 0 &&
            y + drawnRowHeight >= 0 &&
            y <= canvasHeight &&
            insertionBarWidth(inserted, pxPerBp, drawnRowHeight) >
              Math.max(
                2,
                Math.abs(
                  toX(region.cellPositions[i * 2 + 1]!) -
                    toX(region.cellPositions[i * 2]!),
                ),
              )
          ) {
            const x1 = toX(region.cellPositions[i * 2]!)
            const x2 = toX(region.cellPositions[i * 2 + 1]!)
            const xCenter = (x1 + x2) / 2
            ctx.fillStyle = abgrToCssRgba(region.cellColors[i]!)
            drawInsertionMarker(
              ctx,
              xCenter,
              y,
              drawnRowHeight,
              inserted,
              pxPerBp,
            )
            if (getInsertionType(inserted, pxPerBp) === 'large' && labelFits) {
              ctx.fillStyle = 'white'
              ctx.fillText(String(inserted), xCenter, y + drawnRowHeight / 2)
              ctx.fillStyle = abgrToCssRgba(region.cellColors[i]!)
            }
          }
        }
      }
    },
  )
}
