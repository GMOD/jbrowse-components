import {
  MIN_HEIGHT_FOR_TEXT,
  drawInsertionMarker,
  getInsertionType,
  insertionBarWidth,
} from '@jbrowse/alignments-core'
import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'
import {
  forEachClippedBlock,
  pxPerBpOf,
} from '@jbrowse/render-core/canvas2dUtils'

import { forEachFeatureSpan } from './forEachFeatureSpan.ts'
import { drawnCellHeightPx } from './shaders/variant.js.generated.ts'
import { cellCanDrawMarker } from './variantCellSpan.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
} from './variantRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const FONT = '10px sans-serif'
const MARKER_OUTLINE = 'rgba(0,0,0,0.6)'
// The outline is inset half a pixel on every side, so below this a stroke
// leaves no interior and the marker paints the outline colour instead of its
// own.
const MIN_OUTLINED_PX = 5

/**
 * The per-region fields this pass reads, declared structurally rather than as
 * `VariantCellData`: the main thread holds the *shipped* form, whose
 * `featureGenotypeMap` is interned to genotype codes before crossing the RPC
 * boundary. Both satisfy this.
 */
export interface VariantInsertionGlyphData {
  cellRowIndices: Uint32Array
  cellColors: Uint32Array
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
    { drawnHeight: drawnRowHeight, insertionsWiden: true },
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
 * Whether any record in this block can draw an insertion marker, at any
 * sub-pixel pan position. The legend's question, and deliberately not the
 * painter's: see `cellCanDrawMarker`.
 *
 * Bails on the first hit and allocates nothing, where `markersForBlock` fills
 * two typed arrays per block because its caller needs every marker's position.
 */
export function anyMarkerPossibleForBlock(
  region: VariantInsertionGlyphData,
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

/**
 * Insertion markers over the genotype cells, sized by each record's inserted bp.
 *
 * `cellMark` draws a cell across the reference span its record covers,
 * floored at 2px. That is correct for a SNP and for a deletion, and it is why the
 * regular (non-matrix) display reads well for structural variants: everything
 * sits at its true genomic position and width. An insertion is the exception,
 * because it consumes no reference: `wave.vcf.gz` carries ALTs up to 65,481 bp
 * that all land on the same 2px floor a SNP does. This pass is where that length
 * goes.
 *
 * Mirrors `cellMark`'s arguments and geometry (`forEachClippedBlock` +
 * `makeBpMapper`, the same 2px row floor, the same Y-cull) so a marker cannot
 * drift off the cell it widens, and uses `drawInsertionMarker` from
 * `@jbrowse/alignments-core` so the bar geometry stays identical to the pileup's
 * and MAF's.
 *
 * Only cells whose genotype carries a non-reference allele widen
 * (`cellAltDosage`), because widening a reference or no-call cell would claim
 * that haplotype has the sequence.
 *
 * The marker is the cell's own color, widened: hue and shade keep meaning
 * exactly what they mean on the cell (the genotype, or the `featureColor`
 * override), and "this is an insertion" is carried by the mark's shape and
 * width alone. Where the bar is big enough to keep an interior, a 1px outline
 * separates it from the neighbouring cells it reaches across, which are often
 * the same color.
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
  // variant.slang's own 2px floor, generated into TS (adr-051), so a marker
  // cannot be sized against a different band than the cell it widens.
  const drawnRowHeight = drawnCellHeightPx(rowHeight)
  const labelFits = drawnRowHeight >= MIN_HEIGHT_FOR_TEXT
  const outlineFits = drawnRowHeight >= MIN_OUTLINED_PX
  if (labelFits) {
    ctx.font = FONT
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
  }
  ctx.strokeStyle = MARKER_OUTLINE
  ctx.lineWidth = 1

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
        markersForBlock(region, block, drawnRowHeight)
      // A callset where nothing earns a marker — a SNP panel, or any window
      // zoomed out past the point an insertion outgrows its cell — skips the
      // per-cell walk entirely instead of running it to draw nothing.
      if (anyMarker) {
        // Reference cells never carry the alt, so the scan starts at the
        // non-reference bucket (see VariantInsertionGlyphData.refCellCount).
        for (let i = region.refCellCount; i < region.numCells; i++) {
          const featureIdx = region.cellFeatureIndices[i]!
          if (region.cellAltDosage[i] && drawsMarker[featureIdx]) {
            // Y-cull as the block painter does
            const y = region.cellRowIndices[i]! * rowHeight - scrollTop
            if (y + drawnRowHeight >= 0 && y <= canvasHeight) {
              const xCenter = markerXCenter[featureIdx]!
              const inserted = region.featureInsertedBp[featureIdx]!
              const abgr = region.cellColors[i]!
              ctx.fillStyle = abgrToCssRgba(abgr)
              drawInsertionMarker(
                ctx,
                xCenter,
                y,
                drawnRowHeight,
                inserted,
                pxPerBp,
              )
              const w = insertionBarWidth(inserted, pxPerBp, drawnRowHeight)
              if (outlineFits && w >= MIN_OUTLINED_PX) {
                ctx.strokeRect(
                  xCenter - w / 2 + 0.5,
                  y + 0.5,
                  w - 1,
                  drawnRowHeight - 1,
                )
              }
              if (
                getInsertionType(inserted, pxPerBp) === 'large' &&
                labelFits
              ) {
                ctx.fillStyle = labelColorOn(abgr)
                ctx.fillText(String(inserted), xCenter, y + drawnRowHeight / 2)
              }
            }
          }
        }
      }
    },
  )
}

// The count sits inside the bar, so it takes whichever of black and white
// clears the bar's own luminance: a hom cell is dark, a het cell is not.
function labelColorOn(abgr: number) {
  const r = abgr & 255
  const g = (abgr >>> 8) & 255
  const b = (abgr >>> 16) & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? 'black' : 'white'
}
