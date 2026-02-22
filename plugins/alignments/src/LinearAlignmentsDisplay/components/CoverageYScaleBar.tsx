import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

export interface CoverageTicks {
  ticks: { value: number; y: number }[]
  height: number
  maxDepth: number
  nicedMax: number
  yTop: number
  yBottom: number
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

  const { ticks, yTop, yBottom } = coverageTicks
  const bg = theme.palette.background.default
  const fg = theme.palette.text.primary
  const isLeft = orientation === 'left'
  const k = isLeft ? -1 : 1
  const tickLength = 6

  if (ticks.length === 0) {
    return null
  }

  return (
    <g
      fill="none"
      fontSize={10}
      fontFamily="sans-serif"
      textAnchor={isLeft ? 'end' : 'start'}
      strokeWidth={1}
    >
      {/* Axis line - spans full effective coverage area */}
      <path
        stroke={fg}
        d={`M${k * tickLength},${yTop}H0.5V${yBottom}H${k * tickLength}`}
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
