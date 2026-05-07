import type React from 'react'

import { toRgb } from '../../shaders/colors.ts'
import { fillColor } from '../../shared/color.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { CigarCoords } from '../../shared/hitTestTypes.ts'
import type { Theme } from '@mui/material'

export function buildColorPaletteFromTheme(theme: Theme): ColorPalette {
  const { palette } = theme
  return {
    colorFwdStrand: toRgb(fillColor.color_fwd_strand),
    colorRevStrand: toRgb(fillColor.color_rev_strand),
    colorNostrand: toRgb(fillColor.color_nostrand),
    colorPairLR: toRgb(fillColor.color_pair_lr),
    colorPairRL: toRgb(fillColor.color_pair_rl),
    colorPairRR: toRgb(fillColor.color_pair_rr),
    colorPairLL: toRgb(fillColor.color_pair_ll),
    colorBaseA: toRgb(palette.bases.A.main),
    colorBaseC: toRgb(palette.bases.C.main),
    colorBaseG: toRgb(palette.bases.G.main),
    colorBaseT: toRgb(palette.bases.T.main),
    colorInsertion: toRgb(palette.insertion),
    colorDeletion: toRgb(palette.deletion),
    colorSkip: toRgb(palette.skip),
    colorSoftclip: toRgb(palette.softclip),
    colorHardclip: toRgb(palette.hardclip),
    colorCoverage: toRgb(palette.coverage),
    colorModificationFwd: toRgb(palette.modificationFwd),
    colorModificationRev: toRgb(palette.modificationRev),
    colorMutedSnpBase: toRgb(palette.mutedSnpBase),
    colorLongInsert: toRgb(fillColor.color_longinsert),
    colorShortInsert: toRgb(fillColor.color_shortinsert),
    colorSupplementary: toRgb(fillColor.color_supplementary),
    colorUnmappedMate: toRgb(fillColor.color_unmapped_mate),
  }
}

export function canvasToGenomicCoords(
  canvasY: number,
  genomicPos: number,
  bpPerPx: number,
  featureHeight: number,
  featureSpacing: number,
  topOffset: number,
  rangeY: [number, number],
): CigarCoords {
  const rowHeight = featureHeight + featureSpacing
  const adjustedY = canvasY + rangeY[0] - topOffset
  const row = Math.floor(adjustedY / rowHeight)
  const yWithinRow = adjustedY - row * rowHeight
  return { bpPerPx, genomicPos, row, adjustedY, yWithinRow }
}

export function getCanvasCoords(
  e: React.MouseEvent,
  canvas: HTMLCanvasElement | null,
  canvasRectRef: React.RefObject<{ rect: DOMRect; timestamp: number } | null>,
) {
  if (!canvas) {
    return undefined
  }

  const now = Date.now()
  const cached = canvasRectRef.current

  if (cached && now - cached.timestamp < 100) {
    return {
      canvasX: e.clientX - cached.rect.left,
      canvasY: e.clientY - cached.rect.top,
    }
  }

  const rect = canvas.getBoundingClientRect()
  canvasRectRef.current = { rect, timestamp: now }
  return { canvasX: e.clientX - rect.left, canvasY: e.clientY - rect.top }
}

export const CIGAR_TYPE_LABELS: Record<string, string> = {
  mismatch: 'SNP/Mismatch',
  insertion: 'Insertion',
  deletion: 'Deletion',
  skip: 'Skip (Intron)',
  softclip: 'Soft Clip',
  hardclip: 'Hard Clip',
}
