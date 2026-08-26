import { measuredFont } from '@jbrowse/core/util'
import { makeBpMapper, pxPerBpOf } from '@jbrowse/render-core/canvas2dUtils'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { BpRegionBounds } from '@jbrowse/render-core/renderBlock'

// The face the letters draw in. Named because `measuredFont` switches to the
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
  // The face `text` was fitted in, ready for `ctx.font`. The painter never
  // builds the string itself, so it cannot draw in a face the residue-number
  // budget was measured against a different one of.
  font: string
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

// The room a codon must have before its residue number is drawn, as a sample
// string measured at the row's font size: six characters for the widest label
// the format can produce — one amino-acid letter plus five digits, titin (34350
// aa) being the longest protein anyone will open — and a seventh so neighbouring
// labels are separated rather than butted together. Monospace, so which
// characters they are doesn't matter.
const PEPTIDE_NUMBER_CELL_SAMPLE = 'MMMMMMM'

// Bases in a codon. Named because it is the cell the number has to fit, and the
// point below is that it is the FULL codon rather than whatever piece this
// particular residue occupies.
const BASES_PER_CODON = 3

// Whether residue numbers are drawn, from the zoom and the row height alone —
// never from the label actually in hand.
//
// Measuring each residue's own string against its own cell is the obvious rule
// and it looks broken. A transcript crossing residue 999 numbers one half of
// itself and not the other. Every exon boundary does the same locally, because
// the two pieces of a codon straddling one are 1-2bp wide instead of 3. Widening
// the unit only moves the seam: per glyph, two isoforms of one gene disagree;
// per screen, a single titin scrolling into view strips the numbers off every
// other gene and panning flickers all of them.
//
// So: a fixed budget. Numbers appear once a codon is wide enough for the longest
// label the format can ever produce, which makes the answer a function of bpPerPx
// and the row height and nothing else. Every residue on screen agrees, always;
// panning changes nothing; zooming flips all of them together, exactly as the
// letters' own threshold (shouldRenderPeptideText) does one step earlier. The
// price is that a 200aa gene reaches its numbers at the same zoom titin does,
// having reserved digits it never uses — a little more zoom on small proteins,
// in exchange for a view that never disagrees with itself.
//
// Resolved per row rather than per residue: a row's `fontSize` decides both the
// face and the answer, so one `min(heightPx, cap)` produces one `PeptideRow`
// that every residue at that height then reads.
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
  // A whole codon at this zoom, which is the cell the residue number is budgeted
  // against — not `px2 - px1`, which for an exon-boundary fragment is a third of
  // that and would drop the number off exactly those residues, putting the ragged
  // edge back at every boundary.
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
      // The bare letter is drawn whether or not it strictly fits: at one glyph
      // it overhangs by a sliver at worst, and dropping it would leave the
      // codon rect with nothing in it.
      text: row.numbered ? residueLabel(item) : item.aminoAcid,
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
  // The SVG export hands this the layer it has already drawn highlight boxes and
  // floating labels into, so every field is both set and given back rather than
  // inherited: `y` below places an ALPHABETIC baseline, and a 'middle' left
  // behind by another painter slides each letter off the halo drawn under it.
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 1
  // fontSize is min(heightPx, cap), so the font is identical for every residue
  // in a row — reassigning ctx.font per residue would re-parse the same string
  // thousands of times in a dense CDS. Only touch it when the row changes.
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
