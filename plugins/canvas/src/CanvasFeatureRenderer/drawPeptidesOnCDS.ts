import { getEffectiveStrand, getStrandAwareX } from './util'

import type { AggregatedAminoAcid } from './prepareAminoAcidData'

interface DrawPeptidesArgs {
  ctx: CanvasRenderingContext2D
  aggregatedAminoAcids: AggregatedAminoAcid[]
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
 * Draw amino acid text labels on a CDS feature
 * This only draws the text, not the background rectangles
 */
export function drawPeptidesOnCDS(args: DrawPeptidesArgs) {
  const {
    ctx,
    aggregatedAminoAcids,
    left,
    top,
    width,
    height,
    bpPerPx,
    strand,
    reversed,
    canvasWidth,
  } = args

  if (height < 8) {
    return
  }

  const effectiveStrand = getEffectiveStrand(strand, reversed)
  const pxPerBp = 1 / bpPerPx
  const fontSize = height
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const yCenter = top + height / 2

  for (const aa of aggregatedAminoAcids) {
    const startX = getStrandAwareX(left, width, aa.startIndex, pxPerBp, effectiveStrand)
    const endX = getStrandAwareX(left, width, aa.endIndex + 1, pxPerBp, effectiveStrand)
    const x = (startX + endX) / 2

    if (x < 0 || x > canvasWidth) {
      continue
    }

    const isNonTriplet = aa.length % 3 !== 0 || aa.aminoAcid === '&'
    ctx.fillStyle = isNonTriplet ? 'red' : 'black'
    const text =
      isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
        ? aa.aminoAcid
        : `${aa.aminoAcid}${aa.proteinIndex + 1}`
    ctx.fillText(text, x, yCenter)
  }
}
