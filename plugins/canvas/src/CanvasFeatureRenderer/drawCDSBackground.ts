import { colord } from '@jbrowse/core/util/colord'
import { darken, lighten } from '@mui/material'

import { getEffectiveStrand, getStrandAwareX } from './util'

import type { AggregatedAminoAcid } from './prepareAminoAcidData'

interface DrawCDSBackgroundArgs {
  ctx: CanvasRenderingContext2D
  aggregatedAminoAcids: AggregatedAminoAcid[]
  baseColor: string
  left: number
  top: number
  width: number
  height: number
  bpPerPx: number
  strand: number
  reversed: boolean
  canvasWidth: number
}

/**
 * Draw the alternating colored background rectangles for amino acids on a CDS feature
 */
export function drawCDSBackground(args: DrawCDSBackgroundArgs) {
  const {
    ctx,
    aggregatedAminoAcids,
    baseColor,
    left,
    top,
    width,
    height,
    bpPerPx,
    strand,
    reversed,
    canvasWidth,
  } = args

  const effectiveStrand = getEffectiveStrand(strand, reversed)
  const pxPerBp = 1 / bpPerPx
  const baseHex = colord(baseColor).toHex()
  const color1 = lighten(baseHex, 0.2)
  const color2 = darken(baseHex, 0.1)

  for (let i = 0, l = aggregatedAminoAcids.length; i < l; i++) {
    const aa = aggregatedAminoAcids[i]!
    const bgColor = i % 2 === 1 ? color2 : color1

    const startX = getStrandAwareX(left, width, aa.startIndex, pxPerBp, effectiveStrand)
    const endX = getStrandAwareX(left, width, aa.endIndex + 1, pxPerBp, effectiveStrand)
    const rectLeft = Math.min(startX, endX)
    const rectWidth = Math.abs(startX - endX)

    if (rectLeft + rectWidth < 0 || rectLeft > canvasWidth) {
      continue
    }

    ctx.fillStyle = bgColor
    ctx.fillRect(rectLeft, top, rectWidth, height)
  }
}
