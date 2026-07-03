import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

const PEPTIDE_MAX_FONT_SIZE = 16
// Show the residue number after the amino-acid letter once the cell is at
// least this wide; below it only the letter fits.
const PEPTIDE_INDEX_MIN_PX = 20

export interface PeptideCell {
  centerPx: number
  fontSize: number
  text: string
}

// Shared amino-acid cell layout: iterates the on-screen residues in a region and
// hands each a screen-space cell (center x, capped font size, letter +/- residue
// number). Used by the on-screen overlay (PeptideCanvas) and the SVG export
// (renderSvg) via drawPeptides, so the font-size cap, residue-number threshold,
// and horizontal centering can't drift between the two paths.
export function forEachRenderedPeptide(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  emit: (item: AminoAcidOverlayItem, cell: PeptideCell, index: number) => void,
) {
  const { aminoAcidOverlay } = data
  if (!aminoAcidOverlay) {
    return
  }
  const toScreen = makeBpMapper(vr)
  for (const [index, item] of aminoAcidOverlay.entries()) {
    if (item.endBp < vr.start || item.startBp > vr.end) {
      continue
    }
    const px1 = toScreen(item.startBp)
    const px2 = toScreen(item.endBp)
    const showIndex = Math.abs(px2 - px1) >= PEPTIDE_INDEX_MIN_PX
    emit(
      item,
      {
        centerPx: (px1 + px2) / 2,
        fontSize: Math.min(item.heightPx, PEPTIDE_MAX_FONT_SIZE),
        text: showIndex
          ? `${item.aminoAcid}${item.proteinIndex + 1}`
          : item.aminoAcid,
      },
      index,
    )
  }
}

// Paints amino-acid letters into any 2D-canvas-like context, reusing the shared
// cell layout. A white stroke behind each letter keeps it legible over the
// codon color, and stop/partial codons read red. Coordinates are absolute
// track px in the same space
// as the feature rects, so callers draw on a full-track-width canvas without
// per-block clipping. Shared by the on-screen overlay (PeptideCanvas) and the
// SVG export (renderSvg).
export function drawPeptides(
  ctx: Ctx2D,
  data: FeatureDataResult,
  vr: BpRegionBounds,
) {
  ctx.textAlign = 'center'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 1
  // fontSize is min(heightPx, cap), so it's identical for every residue in a
  // row — reassigning ctx.font per residue would re-parse the same string
  // thousands of times in a dense CDS. Only touch it when the size changes.
  let lastFontSize = -1
  forEachRenderedPeptide(data, vr, (item, { centerPx, fontSize, text }) => {
    const y = item.topPx + item.heightPx / 2 + fontSize / 3
    if (fontSize !== lastFontSize) {
      ctx.font = `${fontSize}px monospace`
      lastFontSize = fontSize
    }
    ctx.strokeText(text, centerPx, y)
    ctx.fillStyle = item.isStopOrNonTriplet ? 'red' : 'black'
    ctx.fillText(text, centerPx, y)
  })
  ctx.textAlign = 'start'
}
