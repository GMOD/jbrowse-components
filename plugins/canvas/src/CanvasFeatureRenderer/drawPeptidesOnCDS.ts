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
  } = args

  // Only draw text if height is large enough
  if (height < 8) {
    return
  }

  const flipper = reversed ? -1 : 1
  const rightPos = left + width
  const fontSize = height
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Draw each amino acid text label
  for (const aggregatedAminoAcid of aggregatedAminoAcids) {
    const aa = aggregatedAminoAcid
    const centerIndex = Math.floor((aa.startIndex + aa.endIndex) / 2)
    const isNonTriplet = aa.length % 3 !== 0 || aa.aminoAcid === '&'

    ctx.fillStyle = isNonTriplet ? 'red' : 'black'
    const text =
      isNonTriplet || aa.aminoAcid === '*' || aa.aminoAcid === '&'
        ? aa.aminoAcid
        : `${aa.aminoAcid}${aa.proteinIndex + 1}`

    const yCenter = top + height / 2

    if (strand * flipper === -1) {
      const startX = rightPos - (1 / bpPerPx) * aa.startIndex
      const endX = rightPos - (1 / bpPerPx) * (aa.endIndex + 1)
      const x = (startX + endX) / 2
      ctx.fillText(text, x, yCenter)
    } else {
      const x = left + (1 / bpPerPx) * centerIndex + 1 / bpPerPx / 2
      ctx.fillText(text, x, yCenter)
    }
  }
}
