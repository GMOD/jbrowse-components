import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

export interface CoverageTicks {
  ticks: { value: number; y: number }[]
  height: number
  maxDepth: number
}

const CoverageYScaleBar = observer(function CoverageYScaleBar({
  model,
  orientation,
}: {
  model: { coverageTicks?: CoverageTicks }
  orientation?: 'left' | 'right'
}) {
  const theme = useTheme()
  const coverageTicks = model.coverageTicks

  if (!coverageTicks) {
    return null
  }

  const { ticks } = coverageTicks
  const bg = theme.palette.background.default
  const fg = theme.palette.text.primary
  const isLeft = orientation === 'left'
  const k = isLeft ? -1 : 1
  const tickLength = 6

  // Get the y range from actual tick positions (not full height)
  const firstTick = ticks[0]
  const lastTick = ticks[ticks.length - 1]
  if (!firstTick || !lastTick) {
    return null
  }
  const y0 = Math.min(firstTick.y, lastTick.y)
  const y1 = Math.max(firstTick.y, lastTick.y)

  return (
    <g
      fill="none"
      fontSize={10}
      fontFamily="sans-serif"
      textAnchor={isLeft ? 'end' : 'start'}
      strokeWidth={1}
    >
      {/* Axis line - only spans between tick positions */}
      <path
        stroke={fg}
        d={`M${k * tickLength},${y0}H0.5V${y1}H${k * tickLength}`}
      />
      {/* Ticks and labels */}
      {ticks.map(({ value, y }) => (
        <g key={value} transform={`translate(0,${y})`}>
          <line stroke={fg} x2={k * tickLength} y1={0.5} y2={0.5} />
          <text
            stroke={bg}
            strokeWidth={2.5}
            paintOrder="stroke"
            fill={fg}
            dy="0.32em"
            x={k * 9}
            y={0.5}
          >
            {value}
          </text>
        </g>
      ))}
    </g>
  )
})

export default CoverageYScaleBar
