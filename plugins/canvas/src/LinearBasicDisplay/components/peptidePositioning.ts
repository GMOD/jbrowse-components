import { makeBpMapper } from '@jbrowse/core/gpu/canvas2dUtils'

import type {
  AminoAcidOverlayItem,
  FeatureDataResult,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BpRegionBounds } from '@jbrowse/core/gpu/canvas2dUtils'

const PEPTIDE_MAX_FONT_SIZE = 16
// Show the residue number after the amino-acid letter once the cell is at
// least this wide; below it only the letter fits.
const PEPTIDE_INDEX_MIN_PX = 20

export interface PeptideCell {
  centerPx: number
  fontSize: number
  text: string
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
