import MultiVariantBaseRenderer, {
  type MultiRenderArgsDeserialized,
} from '../MultiVariantBaseRenderer'

interface IntrogressionRenderArgs extends MultiRenderArgsDeserialized {
  introgressionData?: {
    positions: number[]
    refNames: string[]
    abbaCount: number
    babaCount: number
    dStatistic: number
    zScore: number
    pairwiseD: {
      p1p2: number[]
      p1p3: number[]
      p2p3: number[]
    }
  }
  populations: {
    P1: string[]
    P2: string[]
    P3: string[]
    outgroup: string[]
  }
}

export default class MultiLinearVariantIntrogressionRenderer extends MultiVariantBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: IntrogressionRenderArgs,
  ) {
    const { introgressionData, populations, height, width, sources } = props

    if (!introgressionData || !sources) {
      this.drawPlaceholder(ctx, width, height)
      return
    }

    const { dStatistic, zScore, pairwiseD } = introgressionData

    const rowHeight = height / 4
    const textHeight = 16

    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, width, height)

    this.drawDStatistic(ctx, dStatistic, zScore, 0, rowHeight, width, textHeight)

    this.drawPairwiseD(
      ctx,
      'P1 vs P2',
      pairwiseD.p1p2,
      rowHeight,
      rowHeight,
      width,
      textHeight,
    )
    this.drawPairwiseD(
      ctx,
      'P1 vs P3',
      pairwiseD.p1p3,
      rowHeight * 2,
      rowHeight,
      width,
      textHeight,
    )
    this.drawPairwiseD(
      ctx,
      'P2 vs P3',
      pairwiseD.p2p3,
      rowHeight * 3,
      rowHeight,
      width,
      textHeight,
    )

    this.drawPopulationLabels(ctx, populations, sources, width, height)

    return undefined
  }

  drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = '#666'
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      'Configure populations to calculate introgression',
      width / 2,
      height / 2,
    )
  }

  drawDStatistic(
    ctx: CanvasRenderingContext2D,
    dStatistic: number,
    zScore: number,
    y: number,
    rowHeight: number,
    width: number,
    textHeight: number,
  ) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, y, width, rowHeight)

    ctx.strokeStyle = '#ddd'
    ctx.strokeRect(0, y, width, rowHeight)

    ctx.fillStyle = '#333'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('D-statistic', 10, y + 5)

    const barY = y + textHeight + 10
    const barHeight = rowHeight - textHeight - 20
    const barWidth = width - 40

    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(20, barY, barWidth, barHeight)

    const normalized = Math.max(-1, Math.min(1, dStatistic))
    const barFillWidth = ((normalized + 1) / 2) * barWidth

    const color = this.getDStatisticColor(dStatistic, zScore)
    ctx.fillStyle = color
    ctx.fillRect(20, barY, barFillWidth, barHeight)

    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    const centerX = 20 + barWidth / 2
    ctx.beginPath()
    ctx.moveTo(centerX, barY)
    ctx.lineTo(centerX, barY + barHeight)
    ctx.stroke()
    ctx.lineWidth = 1

    ctx.fillStyle = '#000'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(
      `D = ${dStatistic.toFixed(4)}`,
      width - 10,
      barY + barHeight / 2 - 10,
    )
    ctx.fillText(
      `Z = ${zScore.toFixed(2)}`,
      width - 10,
      barY + barHeight / 2 + 10,
    )

    ctx.fillStyle = '#666'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText('-1', 15, barY + barHeight + 5)
    ctx.textAlign = 'center'
    ctx.fillText('0', centerX, barY + barHeight + 5)
    ctx.textAlign = 'right'
    ctx.fillText('+1', 20 + barWidth + 5, barY + barHeight + 5)
  }

  getDStatisticColor(dStatistic: number, zScore: number) {
    const absZ = Math.abs(zScore)
    const isSignificant = absZ > 3

    if (!isSignificant) {
      return '#9e9e9e'
    }

    if (dStatistic > 0) {
      if (absZ > 5) {
        return '#c62828'
      }
      return '#ef5350'
    } else {
      if (absZ > 5) {
        return '#1565c0'
      }
      return '#42a5f5'
    }
  }

  drawPairwiseD(
    ctx: CanvasRenderingContext2D,
    label: string,
    values: number[],
    y: number,
    rowHeight: number,
    width: number,
    textHeight: number,
  ) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, y, width, rowHeight)

    ctx.strokeStyle = '#ddd'
    ctx.strokeRect(0, y, width, rowHeight)

    ctx.fillStyle = '#333'
    ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(label, 10, y + 5)

    if (!values || values.length === 0) {
      return
    }

    const graphY = y + textHeight + 5
    const graphHeight = rowHeight - textHeight - 10
    const graphWidth = width - 20
    const pointWidth = graphWidth / values.length

    const maxVal = Math.max(...values, 0.1)

    ctx.fillStyle = '#2196f3'
    for (let i = 0; i < values.length; i++) {
      const value = values[i] ?? 0
      const barHeight = (value / maxVal) * graphHeight
      const x = 10 + i * pointWidth

      ctx.fillRect(x, graphY + graphHeight - barHeight, pointWidth, barHeight)
    }

    const meanVal = values.reduce((a, b) => a + b, 0) / values.length
    ctx.strokeStyle = '#f44336'
    ctx.lineWidth = 2
    const meanY = graphY + graphHeight - (meanVal / maxVal) * graphHeight
    ctx.beginPath()
    ctx.moveTo(10, meanY)
    ctx.lineTo(10 + graphWidth, meanY)
    ctx.stroke()
    ctx.lineWidth = 1

    ctx.fillStyle = '#000'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`Mean: ${meanVal.toFixed(4)}`, width - 10, y + textHeight + 10)
  }

  drawPopulationLabels(
    ctx: CanvasRenderingContext2D,
    populations: {
      P1: string[]
      P2: string[]
      P3: string[]
      outgroup: string[]
    },
    sources: any[],
    width: number,
    height: number,
  ) {
    const labelY = height - 60
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.fillRect(10, labelY, width - 20, 50)

    ctx.strokeStyle = '#ddd'
    ctx.strokeRect(10, labelY, width - 20, 50)

    ctx.fillStyle = '#333'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const labels = [
      `P1 (n=${populations.P1.length})`,
      `P2 (n=${populations.P2.length})`,
      `P3 (n=${populations.P3.length})`,
      `Outgroup (n=${populations.outgroup.length})`,
    ]

    const colors = ['#4caf50', '#2196f3', '#ff9800', '#9c27b0']

    for (let i = 0; i < labels.length; i++) {
      const x = 20 + (i % 2) * (width / 2 - 20)
      const y = labelY + 10 + Math.floor(i / 2) * 20

      ctx.fillStyle = colors[i] ?? '#333'
      ctx.fillRect(x, y, 10, 10)

      ctx.fillStyle = '#333'
      ctx.fillText(labels[i] ?? '', x + 15, y)
    }
  }
}
