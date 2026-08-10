import { measureText } from '@jbrowse/core/util'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// The face the letters draw in. Named because `measureText` switches to the
// fixed monospace advance on seeing it, and a cell measured in one face and
// painted in another is exactly the drift this module exists to prevent.
const PEPTIDE_FONT_FAMILY = 'monospace'

const PEPTIDE_MAX_FONT_SIZE = 16

// Below this the letters are a smudge rather than text, so the overlay draws
// nothing and lets the codon coloring carry the frame on its own — the same
// call LABEL_FONT_MULTIPLIERS makes for floating labels, which are deliberately
// shrunk more gently than the feature body so superCompact doesn't render them
// at ~3px. Peptide letters take the body scale directly (layout.ts scales
// `heightPx` by HEIGHT_MULTIPLIERS), so superCompact's 0.3 puts a default 10px
// feature at 3px with nothing to stop it.
//
// The floor is a *drawing* threshold only. `findPeptideAt` hit-tests the same
// residues off `aminoAcidOverlay` untouched, so the hover still names the codon
// under the cursor at any size.
const PEPTIDE_MIN_FONT_SIZE = 5

export interface PeptideCell {
  centerPx: number
  fontSize: number
  text: string
}

// The residue as the UI names it: the amino-acid letter and its 1-based protein
// position, `K124`. Shared with the hover tooltip (hitTesting's tooltipRows) so
// the letter drawn in the codon and the residue named on hovering it are one
// string built one way.
export function residueLabel(item: {
  aminoAcid: string
  proteinIndex: number
}) {
  return `${item.aminoAcid}${item.proteinIndex + 1}`
}

// Shared amino-acid cell layout: iterates the on-screen residues in a region and
// hands each a screen-space cell (center x, capped font size, letter +/- residue
// number). Used by the on-screen overlay (PeptideCanvas) and the SVG export
// (renderSvg) via drawPeptides, so the font-size cap, residue-number threshold,
// and horizontal centering can't drift between the two paths.
export function forEachRenderedPeptide(
  data: FeatureDataResult,
  vr: BpRegionBounds,
  emit: (item: AminoAcidOverlayItem, cell: PeptideCell) => void,
) {
  const { aminoAcidOverlay } = data
  if (!aminoAcidOverlay) {
    return
  }
  const toScreen = makeBpMapper(vr)
  for (const item of aminoAcidOverlay) {
    if (item.endBp < vr.start || item.startBp > vr.end) {
      continue
    }
    const fontSize = Math.min(item.heightPx, PEPTIDE_MAX_FONT_SIZE)
    if (fontSize < PEPTIDE_MIN_FONT_SIZE) {
      continue
    }
    const px1 = toScreen(item.startBp)
    const px2 = toScreen(item.endBp)
    // Whether the residue number fits is a question about the *string*, not
    // about the cell alone: it is one character for the letter plus as many as
    // five digits for the position, and a fixed px threshold cannot tell `M1`
    // from `M12345`. A flat 20px let TTN (34350 aa) and DMD (3685 aa) collide
    // their numbers into their neighbours at the coarsest zoom the letters draw
    // at — where a whole codon is only 3 / (1/8) = 24px wide — while never once
    // firing for a full codon, since 24 >= 20 always.
    const withIndex = residueLabel(item)
    const fits =
      measureText(withIndex, fontSize, PEPTIDE_FONT_FAMILY) <=
      Math.abs(px2 - px1)
    emit(item, {
      centerPx: (px1 + px2) / 2,
      fontSize,
      // The bare letter is drawn whether or not it strictly fits: at one glyph
      // it overhangs by a sliver at worst, and dropping it would leave the
      // codon rect with nothing in it.
      text: fits ? withIndex : item.aminoAcid,
    })
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
      ctx.font = `${fontSize}px ${PEPTIDE_FONT_FAMILY}`
      lastFontSize = fontSize
    }
    ctx.strokeText(text, centerPx, y)
    ctx.fillStyle = item.isStopOrNonTriplet ? 'red' : 'black'
    ctx.fillText(text, centerPx, y)
  })
  ctx.textAlign = 'start'
}

// Paint every visible region's peptides through drawPeptides. The single entry
// point for both the on-screen overlay (PeptideCanvas) and the SVG export
// (renderSvg), so the export can't drift from the app: same region walk, same
// data lookup, same draw. A codon straddling a region boundary is painted by
// both neighbors, but makeBpMapper is continuous across back-to-back regions so
// the two land at the same absolute px — an identical overstrike, not a double.
export function drawPeptidesForRegions(
  ctx: Ctx2D,
  dataMap: ReadonlyMap<number, FeatureDataResult>,
  regions: readonly (BpRegionBounds & { displayedRegionIndex: number })[],
) {
  for (const vr of regions) {
    const data = dataMap.get(vr.displayedRegionIndex)
    if (data) {
      drawPeptides(ctx, data, vr)
    }
  }
}
