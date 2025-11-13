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
  } = args

  const flipper = reversed ? -1 : 1
  const rightPos = left + width

  // Draw each amino acid background
  for (const [index, aggregatedAminoAcid] of aggregatedAminoAcids.entries()) {
    const aa = aggregatedAminoAcid
    const isAlternate = index % 2 === 1
    const bgColor = isAlternate
      ? darken(colord(baseColor).toHex(), 0.1)
      : lighten(colord(baseColor).toHex(), 0.2)

    if (strand * flipper === -1) {
      const startX = rightPos - (1 / bpPerPx) * aa.startIndex
      const endX = rightPos - (1 / bpPerPx) * (aa.endIndex + 1)
      const rectWidth = startX - endX

      ctx.fillStyle = bgColor
      ctx.fillRect(endX, top, rectWidth, height)
    } else {
      const startX = left + (1 / bpPerPx) * aa.startIndex
      const endX = left + (1 / bpPerPx) * (aa.endIndex + 1)
      const rectWidth = endX - startX

      ctx.fillStyle = bgColor
      ctx.fillRect(startX, top, rectWidth, height)
    }
  }
}
