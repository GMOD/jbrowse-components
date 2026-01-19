import { useTheme } from '@mui/material'

const Y_AXIS_WIDTH = 40
const YSCALEBAR_LABEL_OFFSET = 5

/**
 * Y-axis scalebar for the recombination track.
 * Renders as a React/SVG component similar to the wiggle YScaleBar.
 */
export default function RecombinationYScaleBar({
  height,
  maxValue,
  exportSVG,
}: {
  height: number
  maxValue: number
  exportSVG?: boolean
}) {
  const theme = useTheme()
  const topPadding = YSCALEBAR_LABEL_OFFSET
  const bottomPadding = YSCALEBAR_LABEL_OFFSET
  const plotHeight = height - topPadding - bottomPadding

  const fg = exportSVG ? '#333' : theme.palette.text.primary
  const bg = exportSVG ? '#fafafa' : theme.palette.background.default

  // Generate y-axis ticks
  const numTicks = 4
  const ticks: { value: number; y: number }[] = []
  for (let i = 0; i <= numTicks; i++) {
    const value = (maxValue * i) / numTicks
    const y = topPadding + plotHeight * (1 - i / numTicks)
    ticks.push({ value, y })
  }

  const range0 = topPadding + 0.5
  const range1 = topPadding + plotHeight + 0.5

  const content = (
    <>
      {/* Y-axis background */}
      <rect x={0} y={0} width={Y_AXIS_WIDTH} height={height} fill={bg} />

      {/* Y-axis frame and ticks */}
      <g
        fill="none"
        fontSize={9}
        fontFamily="sans-serif"
        textAnchor="end"
        strokeWidth={1}
      >
        {/* Axis line with end caps */}
        <path
          stroke={fg}
          d={`M${Y_AXIS_WIDTH - 6},${range0}H${Y_AXIS_WIDTH - 0.5}V${range1}H${Y_AXIS_WIDTH - 6}`}
        />

        {/* Tick marks and labels */}
        {ticks.map((tick, idx) => (
          <g key={idx} transform={`translate(0,${tick.y})`}>
            <line
              stroke={fg}
              x1={Y_AXIS_WIDTH - 6}
              x2={Y_AXIS_WIDTH}
              y1={0.5}
              y2={0.5}
            />
            <text
              stroke={bg}
              strokeWidth={2}
              paintOrder="stroke"
              fill={fg}
              dy="0.32em"
              x={Y_AXIS_WIDTH - 9}
              y={0.5}
            >
              {tick.value.toFixed(2)}
            </text>
          </g>
        ))}
      </g>

      {/* Y-axis title */}
      <text
        x={10}
        y={height / 2}
        fontSize={10}
        fill={fg}
        fontFamily="sans-serif"
        textAnchor="middle"
        transform={`rotate(-90, 10, ${height / 2})`}
      >
        1 - r²
      </text>
    </>
  )

  if (exportSVG) {
    return <g>{content}</g>
  }

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: Y_AXIS_WIDTH,
        height,
        zIndex: 1,
      }}
      width={Y_AXIS_WIDTH}
      height={height}
    >
      {content}
    </svg>
  )
}

export { Y_AXIS_WIDTH }
