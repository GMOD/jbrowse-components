const Y_AXIS_WIDTH = 40

/**
 * SVG Recombination rate track for SVG export
 * Shows 1 - r² between adjacent SNPs as a proxy for recombination
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
      points.push(`${points.length === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    }
  }

  if (points.length < 2 || firstX === undefined || lastX === undefined) {
    return null
  }

  // Create area path (fill under the line)
  const baseY = topPadding + plotHeight
  const areaPath = `${points.join(' ')} L ${lastX.toFixed(1)} ${baseY.toFixed(1)} L ${firstX.toFixed(1)} ${baseY.toFixed(1)} Z`

  // Generate y-axis ticks
  const numTicks = 4
  const ticks: { value: number; y: number }[] = []
  for (let i = 0; i <= numTicks; i++) {
    const value = (maxValue * i) / numTicks
    const y = topPadding + plotHeight * (1 - i / numTicks)
    ticks.push({ value, y })
  }

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

      {/* Y-axis background */}
      <rect x={0} y={0} width={Y_AXIS_WIDTH} height={height} fill="#fafafa" />

      {/* Y-axis line */}
      <line
        x1={Y_AXIS_WIDTH}
        y1={topPadding}
        x2={Y_AXIS_WIDTH}
        y2={topPadding + plotHeight}
        stroke="#999"
        strokeWidth={1}
      />

      {/* Y-axis ticks and labels */}
      {ticks.map((tick, i) => (
        <g key={i}>
          <line
            x1={Y_AXIS_WIDTH - 4}
            y1={tick.y}
            x2={Y_AXIS_WIDTH}
            y2={tick.y}
            stroke="#999"
            strokeWidth={1}
          />
          <text
            x={Y_AXIS_WIDTH - 6}
            y={tick.y + 3}
            fontSize={9}
            fill="#666"
            fontFamily="sans-serif"
            textAnchor="end"
          >
            {tick.value.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Y-axis title */}
      <text
        x={12}
        y={height / 2}
        fontSize={10}
        fill="#333"
        fontFamily="sans-serif"
        textAnchor="middle"
        transform={`rotate(-90, 12, ${height / 2})`}
      >
        1 - r²
      </text>

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
