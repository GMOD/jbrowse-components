import {
  MIN_HEIGHT_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
} from '@jbrowse/alignments-core'
import { forEachClippedBlock } from '@jbrowse/render-core/canvas2dUtils'

import { getInsertionColorForDosage } from '../../shared/constants.ts'
import { forEachFeatureSpan } from './forEachFeatureSpan.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'

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
  cellRowIndices: Uint32Array
  cellAltDosage: Uint8Array
  cellFeatureIndices: Uint32Array
  featurePositions: Uint32Array
  featureInsertedBp: Int32Array
  numCells: number
  // Where the non-reference bucket starts. Only alt-carrying cells widen, and
  // `isAlt` implies `!isReference` (see computeVariantCells' addCell), so every
  // cell this pass can draw lives at or after this index — the reference bucket,
  // which on a cohort VCF is most of the payload, is skipped outright.
  refCellCount: number
}

/**
 * Which records in one block earn a marker, and where its center sits.
 *
 * Whether a marker is drawn depends only on the feature — every cell of one
 * variant shares its span and its inserted bp — so this walks `featurePositions`
 * (thousands) rather than the cells (features × samples). Records that insert
 * nothing are every SNP and every deletion and can't produce a marker;
 * `variantCellSpanPx` short-circuits them to their plain span, which is false
 * for `drawsMarker`. (They used to be skipped before the bp→px mapping too, back
 * when this walk was its own; two multiplies per skipped feature is not worth a
 * second copy of the geometry that decides where a marker goes.)
 *
 * Split out of the draw so the legend can ask the painter's own question instead
 * of approximating it. Both cheaper approximations are wrong on real figures:
 * "the window holds an insertion" puts a swatch on a callset of short indels,
 * which can never draw a marker at any zoom (`insertionBarWidth` returns 1px
 * below `LONG_INSERTION_MIN_LENGTH`, under the 2px cell floor); "the window
 * holds a long insertion" puts one on any view zoomed out far enough that even a
 * long bar falls under that floor, which is three of the fourteen committed
 * figures carrying this display.
 */
export function markersForBlock(
  region: VariantInsertionGlyphData,
  block: VariantRenderBlock,
  drawnRowHeight: number,
  canvasWidth: number,
) {
  const numFeatures = region.featureInsertedBp.length
  const drawsMarker = new Uint8Array(numFeatures)
  const markerXCenter = new Float64Array(numFeatures)
  let anyMarker = false
  // `forEachFeatureSpan` is the walk `variantCellSpanPx` backs, so a marker
  // cannot be sized against a different span than the cell it widens.
  const pxPerBp = forEachFeatureSpan(
    region,
    block,
    // `true` is not the `showInsertionGlyphs` setting leaking a default: this
    // function's answer *is* the markers, and both callers already return early
    // when the setting is off. Asking for spans with the widening switched off
    // would be asking which markers a display that draws none draws.
    { drawnHeight: drawnRowHeight, insertionsWiden: true, canvasWidth },
    (f, span) => {
      if (span.drawsMarker) {
        markerXCenter[f] = span.center
        drawsMarker[f] = 1
        anyMarker = true
      }
    },
  )
  return { drawsMarker, markerXCenter, anyMarker, pxPerBp }
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
 * Only cells whose genotype carries a non-reference allele widen
 * (`cellAltDosage`), because widening a reference or no-call cell would claim
 * that haplotype has the sequence.
 *
 * Markers take one category color, `insertionColor` — the caller passes the
 * theme's `palette.insertion`, which is what the pileup
 * (`alignmentComponentUtils`) and the MAF display (`drawMafInsertions`) paint
 * their insertions with, so the three agree and a custom theme moves all three
 * together.
 *
 * They used to take the cell's own genotype color, on the reasoning that the
 * color is what says which allele the haplotype carries and the marker only
 * supplies length. That does not survive the geometry: the bar is
 * `insertionBarWidth` wide where the cell under it is the 2px floor, so at 60
 * bp/px a 7.8kb insertion paints a 34px box across a row of OTHER records'
 * cells. In genotype coloring those neighbours are the same dark blue, so the
 * marker was invisible against them and only its white label survived — a
 * number floating in a solid field, which is exactly what a docs review
 * reported.
 *
 * The dosage that fill used to carry is not lost with it: the record's own cell
 * is still drawn at its reference span underneath, and every mode reports the
 * genotype on hover.
 *
 * Shared by the on-screen overlay and the SVG export.
 */
export function drawVariantInsertionGlyphs(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, VariantInsertionGlyphData>,
  blocks: VariantRenderBlock[],
  state: VariantRenderState,
  insertionColor: string,
) {
  const { canvasWidth, canvasHeight, rowHeight, scrollTop } = state
  // variant.slang's own 2px floor, generated into TS (adr-051), so a marker
  // cannot be sized against a different band than the cell it widens.
  const drawnRowHeight = drawnCellHeightPx(rowHeight)
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
      const { drawsMarker, markerXCenter, anyMarker, pxPerBp } =
        markersForBlock(region, block, drawnRowHeight, canvasWidth)
      // A callset where nothing earns a marker — a SNP panel, or any window
      // zoomed out past the point an insertion outgrows its cell — skips the
      // per-cell walk entirely instead of running it to draw nothing.
      if (anyMarker) {
        // The dosage the context's fillStyle currently reflects, so a run of
        // markers at the same dosage neither rebuilds the color string nor
        // reassigns fillStyle. -1 is "not a marker color" — the label below
        // sets it back to that. A real callset has two or three distinct
        // dosages, so the recompute is skipped for nearly every marker.
        let currentDosage = -1
        // Reference cells never carry the alt, so the scan starts at the
        // non-reference bucket (see VariantInsertionGlyphData.refCellCount).
        for (let i = region.refCellCount; i < region.numCells; i++) {
          const featureIdx = region.cellFeatureIndices[i]!
          const dosage = region.cellAltDosage[i]!
          if (dosage && drawsMarker[featureIdx]) {
            // Y-cull as the block painter does
            const y = region.cellRowIndices[i]! * rowHeight - scrollTop
            if (y + drawnRowHeight >= 0 && y <= canvasHeight) {
              const xCenter = markerXCenter[featureIdx]!
              const inserted = region.featureInsertedBp[featureIdx]!
              if (dosage !== currentDosage) {
                ctx.fillStyle = getInsertionColorForDosage(
                  insertionColor,
                  dosage,
                )
                currentDosage = dosage
              }
              drawInsertionMarker(
                ctx,
                xCenter,
                y,
                drawnRowHeight,
                inserted,
                pxPerBp,
              )
              if (
                getInsertionType(inserted, pxPerBp) === 'large' &&
                labelFits
              ) {
                ctx.fillStyle = 'white'
                ctx.fillText(String(inserted), xCenter, y + drawnRowHeight / 2)
                // The label is the only thing that changes the fill mid-loop,
                // so record that the context no longer holds a marker color
                // rather than paying a restore the next marker may not need.
                currentDosage = -1
              }
            }
          }
        }
      }
    },
  )
}
