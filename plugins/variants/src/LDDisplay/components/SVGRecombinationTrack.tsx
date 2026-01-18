import { Y_AXIS_WIDTH } from '../../shared/components/RecombinationYScaleBar.tsx'

/**
 * SVG Recombination rate track for SVG export
 * Shows 1 - r² between adjacent SNPs as a proxy for recombination
 * Note: The Y-axis scalebar is rendered separately via SVGRecombinationYScaleBar
 */
export default function SVGRecombinationTrack({
  recombination,
  width,
  height,
  bpPerPx,
  regionStart,
}: {
  recombination: { values: number[]; positions: number[] }
  width: number
  height: number
  bpPerPx: number
  regionStart: number
}) {
  if (recombination.values.length === 0) {
    return null
  }

  const topPadding = 5
  const bottomPadding = 5
  const plotHeight = height - topPadding - bottomPadding
  const plotLeft = Y_AXIS_WIDTH
  const plotWidth = width - Y_AXIS_WIDTH
  const maxValue = Math.max(...recombination.values, 0.1)

  // Build SVG path for the recombination line
  const points: string[] = []
  let firstX: number | undefined
  let lastX: number | undefined

  for (let i = 0; i < recombination.values.length; i++) {
    const pos = recombination.positions[i]!
    const value = recombination.values[i]!
    const x = plotLeft + (pos - regionStart) / bpPerPx
    const y = topPadding + plotHeight * (1 - value / maxValue)

    if (x >= plotLeft && x <= width) {
      if (firstX === undefined) {
        firstX = x
      }
      lastX = x
      points.push(
        `${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`,
      )
    }
  }

  if (points.length < 2 || firstX === undefined || lastX === undefined) {
    return null
  }

  // Create area path (fill under the line)
  const baseY = topPadding + plotHeight
  const areaPath = `${points.join(' ')} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`

  return (
    <g>
      {/* Background for the plot area */}
      <rect
        x={plotLeft}
        y={topPadding}
        width={plotWidth}
        height={plotHeight}
        fill="rgba(0,0,0,0.02)"
      />

      {/* Filled area under the curve */}
      <path d={areaPath} fill="rgba(59, 130, 246, 0.2)" />

      {/* Line showing recombination rate */}
      <path
        d={points.join(' ')}
        fill="none"
        stroke="rgb(59, 130, 246)"
        strokeWidth={1.5}
      />
    </g>
  )
}
