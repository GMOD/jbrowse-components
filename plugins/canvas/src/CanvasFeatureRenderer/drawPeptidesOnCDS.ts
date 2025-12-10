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

  const flipper = reversed ? -1 : 1
  const rightPos = left + width
  const fontSize = height
  ctx.font = `${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const yCenter = top + height / 2

  for (const aa of aggregatedAminoAcids) {
    let x: number
    if (strand * flipper === -1) {
      const startX = rightPos - (1 / bpPerPx) * aa.startIndex
      const endX = rightPos - (1 / bpPerPx) * (aa.endIndex + 1)
      x = (startX + endX) / 2
    } else {
      const centerIndex = Math.floor((aa.startIndex + aa.endIndex) / 2)
      x = left + (1 / bpPerPx) * centerIndex + 1 / bpPerPx / 2
    }

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
