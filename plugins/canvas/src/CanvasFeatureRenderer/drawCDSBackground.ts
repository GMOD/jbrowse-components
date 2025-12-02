import { colord } from '@jbrowse/core/util/colord'
import { darken, lighten } from '@mui/material'

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

  const flipper = reversed ? -1 : 1
  const rightPos = left + width
  const baseHex = colord(baseColor).toHex()
  const color1 = lighten(baseHex, 0.2)
  const color2 = darken(baseHex, 0.1)

  for (let i = 0, l = aggregatedAminoAcids.length; i < l; i++) {
    const aa = aggregatedAminoAcids[i]!
    const bgColor = i % 2 === 1 ? color2 : color1

    if (strand * flipper === -1) {
      const startX = rightPos - (1 / bpPerPx) * aa.startIndex
      const endX = rightPos - (1 / bpPerPx) * (aa.endIndex + 1)
      if (startX < 0 || endX > canvasWidth) {
        continue
      }
      ctx.fillStyle = bgColor
      ctx.fillRect(endX, top, startX - endX, height)
    } else {
      const startX = left + (1 / bpPerPx) * aa.startIndex
      const endX = left + (1 / bpPerPx) * (aa.endIndex + 1)
      if (endX < 0 || startX > canvasWidth) {
        continue
      }
      ctx.fillStyle = bgColor
      ctx.fillRect(startX, top, endX - startX, height)
    }
  }
}
