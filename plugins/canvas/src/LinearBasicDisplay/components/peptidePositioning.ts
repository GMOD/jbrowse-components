import { measuredFont } from '@jbrowse/core/util'
import { makeBpMapper, pxPerBpOf } from '@jbrowse/render-core/canvas2dUtils'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// `measuredFont` switches to the fixed monospace advance on seeing this name.
const PEPTIDE_FONT_FAMILY = 'monospace'

const PEPTIDE_MAX_FONT_SIZE = 16

// Below this the letters are a smudge, so the overlay draws nothing and lets the
// codon coloring carry the frame. A drawing threshold only: `findPeptideAt`
// still names the codon under the cursor at any size.
const PEPTIDE_MIN_FONT_SIZE = 5

export interface PeptideCell {
  centerPx: number
  fontSize: number
  // The face `text` was fitted in: the painter never builds the string itself,
  // so it cannot draw in a face the number budget was measured against.
  font: string
  text: string
}

export function residueLabel(item: {
  aminoAcid: string
  proteinIndex: number
}) {
  return `${item.aminoAcid}${item.proteinIndex + 1}`
}

// Six characters for the widest label the format can produce — a letter plus
// five digits, titin being the longest protein anyone opens — and a seventh so
// neighbouring labels stay apart. Monospace, so which characters they are does
// not matter.
const PEPTIDE_NUMBER_CELL_SAMPLE = 'MMMMMMM'

const BASES_PER_CODON = 3

// Numbers appear once a codon fits the longest label the format can ever
// produce, so whether they draw is a function of bpPerPx and row height alone.
// Measuring each residue's own string instead numbers one half of a transcript
// crossing residue 999 and not the other, and flickers the rest on every pan.
interface PeptideRow {
  fontSize: number
  font: string
  numbered: boolean
}

function peptideRow(fontSize: number, codonPx: number): PeptideRow {
  const { css, measure } = measuredFont(fontSize, PEPTIDE_FONT_FAMILY)
  return {
    fontSize,
    font: css,
    numbered: measure(PEPTIDE_NUMBER_CELL_SAMPLE) <= codonPx,
  }
}

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
  // A whole codon, not `px2 - px1`: an exon-boundary fragment is a third as wide
  // and would lose its number.
  const codonPx = BASES_PER_CODON * pxPerBpOf(vr)
  let row: PeptideRow | undefined
  for (const item of aminoAcidOverlay) {
    if (item.endBp < vr.start || item.startBp > vr.end) {
      continue
    }
    const fontSize = Math.min(item.heightPx, PEPTIDE_MAX_FONT_SIZE)
    if (fontSize < PEPTIDE_MIN_FONT_SIZE) {
      continue
    }
    if (row?.fontSize !== fontSize) {
      row = peptideRow(fontSize, codonPx)
    }
    const px1 = toScreen(item.startBp)
    const px2 = toScreen(item.endBp)
    emit(item, {
      centerPx: (px1 + px2) / 2,
      fontSize,
      font: row.font,
      // The bare letter draws whether or not it strictly fits; dropping it
      // would leave the codon rect empty.
      text: row.numbered ? residueLabel(item) : item.aminoAcid,
    })
  }
}

// Draws in absolute track px, the same space as the feature rects, so a caller
// paints on a full-track-width canvas with no per-block clipping.
export function drawPeptides(
  ctx: Ctx2D,
  data: FeatureDataResult,
  vr: BpRegionBounds,
) {
  // The SVG export hands over a layer other painters have already used, so every
  // field is set and restored here: a leftover 'middle' baseline would slide each
  // letter off the halo drawn under it.
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 1
  // Every residue in a row shares a font, and reassigning ctx.font per residue
  // re-parses the same string thousands of times in a dense CDS.
  let lastFont = ''
  let lastFill = ''
  forEachRenderedPeptide(
    data,
    vr,
    (item, { centerPx, fontSize, font, text }) => {
      const y = item.topPx + item.heightPx / 2 + fontSize / 3
      if (font !== lastFont) {
        ctx.font = font
        lastFont = font
      }
      ctx.strokeText(text, centerPx, y)
      const fill = item.isStopOrNonTriplet ? 'red' : 'black'
      if (fill !== lastFill) {
        ctx.fillStyle = fill
        lastFill = fill
      }
      ctx.fillText(text, centerPx, y)
    },
  )
  ctx.restore()
}

// Both neighbours paint a codon straddling a region boundary, and `makeBpMapper`
// is continuous across back-to-back regions, so the two land at the same
// absolute px — an overstrike rather than a double.
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
