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

// One-letter code → three-letter abbreviation + full name, for hover tooltips.
// U/O are selenocysteine/pyrrolysine (transl_except residues); * is a stop and
// X is an unknown/ambiguous residue.
const aminoAcidNames: Record<string, [string, string]> = {
  A: ['Ala', 'Alanine'],
  R: ['Arg', 'Arginine'],
  N: ['Asn', 'Asparagine'],
  D: ['Asp', 'Aspartate'],
  C: ['Cys', 'Cysteine'],
  E: ['Glu', 'Glutamate'],
  Q: ['Gln', 'Glutamine'],
  G: ['Gly', 'Glycine'],
  H: ['His', 'Histidine'],
  I: ['Ile', 'Isoleucine'],
  L: ['Leu', 'Leucine'],
  K: ['Lys', 'Lysine'],
  M: ['Met', 'Methionine'],
  F: ['Phe', 'Phenylalanine'],
  P: ['Pro', 'Proline'],
  S: ['Ser', 'Serine'],
  T: ['Thr', 'Threonine'],
  W: ['Trp', 'Tryptophan'],
  Y: ['Tyr', 'Tyrosine'],
  V: ['Val', 'Valine'],
  U: ['Sec', 'Selenocysteine'],
  O: ['Pyl', 'Pyrrolysine'],
}

// Tooltip text for a single hovered amino-acid codon, e.g.
// "Lys (K) · residue 124". Stop codons and partial codons (split across an exon
// boundary) get a trailing note.
export function peptideTooltipText(item: AminoAcidOverlayItem) {
  const { aminoAcid, proteinIndex, isStopOrNonTriplet } = item
  const residue = `residue ${proteinIndex + 1}`
  if (aminoAcid === '*') {
    return `Stop (*) · ${residue}`
  }
  const named = aminoAcidNames[aminoAcid]
  const label = named ? `${named[1]} (${aminoAcid})` : aminoAcid
  // non-'*' codons are only flagged when split across an exon boundary
  return isStopOrNonTriplet
    ? `${label} · ${residue} · partial codon`
    : `${label} · ${residue}`
}

// Shared amino-acid cell layout for the DOM overlay (useAminoAcidOverlay) and
// the SVG export (renderPeptides), so the font-size cap, residue-number
// threshold, and horizontal centering can't drift between the two paths.
// Vertical placement and color stay per-renderer (CSS line-height vs computed
// baseline; theme palette vs hard-coded export colors).
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
// codon color, and stop/partial codons read red (matching the SVG export and
// the prior DOM overlay). Coordinates are absolute track px in the same space
// as the feature rects, so callers draw on a full-track-width canvas without
// per-block clipping. Shared by the on-screen overlay (PeptideCanvas) and the
// SVG export (renderSvg).
export function drawPeptides(
  ctx: Ctx2D,
  data: FeatureDataResult,
  vr: BpRegionBounds,
) {
  ctx.textAlign = 'center'
  forEachRenderedPeptide(data, vr, (item, { centerPx, fontSize, text }) => {
    const y = item.topPx + item.heightPx / 2 + fontSize / 3
    ctx.font = `${fontSize}px monospace`
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1
    ctx.strokeText(text, centerPx, y)
    ctx.fillStyle = item.isStopOrNonTriplet ? 'red' : 'black'
    ctx.fillText(text, centerPx, y)
  })
  ctx.textAlign = 'start'
}
