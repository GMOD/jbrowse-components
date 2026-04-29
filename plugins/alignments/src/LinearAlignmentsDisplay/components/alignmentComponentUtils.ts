import type React from 'react'

import { toRgb } from '../../shaders/colors.ts'
import { fillColor } from '../../shared/color.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types'
import type { ColorPalette } from '../../shaders/colors.ts'
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
  canvasX: number,
  canvasY: number,
  resolved: {
    rpcData: PileupDataResult
    bpRange: [number, number]
    blockStartPx: number
    blockWidth: number
    reversed?: boolean
  },
  featureHeight: number,
  featureSpacing: number,
  topOffset: number,
  rangeY: [number, number],
) {
  const { bpRange, blockStartPx, blockWidth } = resolved
  const bpSpan = bpRange[1] - bpRange[0]
  const bpPerPx = bpSpan / blockWidth
  const frac = (canvasX - blockStartPx) / blockWidth
  const genomicPos = resolved.reversed
    ? bpRange[1] - frac * bpSpan
    : bpRange[0] + frac * bpSpan
  const rowHeight = featureHeight + featureSpacing
  const scrolledY = canvasY + rangeY[0]
  const adjustedY = scrolledY - topOffset
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
