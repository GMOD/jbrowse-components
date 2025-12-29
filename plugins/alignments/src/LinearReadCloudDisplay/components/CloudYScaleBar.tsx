import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { CloudTicks } from '../../RenderLinearReadCloudDisplayRPC/drawFeatsCloud'

function formatTickValue(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}k`
  }
  return `${value}`
}

const CloudYScaleBar = observer(function CloudYScaleBar({
  model,
  orientation,
}: {
  model: { cloudTicks?: CloudTicks }
  orientation?: 'left' | 'right'
}) {
  const theme = useTheme()
  const cloudTicks = model.cloudTicks

  if (!cloudTicks) {
    return null
  }

  const { ticks, height } = cloudTicks
  const bg = theme.palette.background.default
  const fg = theme.palette.text.primary
  const isLeft = orientation === 'left'
  const k = isLeft ? -1 : 1
  const tickLength = 6

  return (
    <g
      fill="none"
      fontSize={10}
      fontFamily="sans-serif"
      textAnchor={isLeft ? 'end' : 'start'}
      strokeWidth={1}
    >
      {/* Axis line */}
      <path
        stroke={fg}
        d={`M${k * tickLength},0H0.5V${height}H${k * tickLength}`}
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
            {formatTickValue(value)}
          </text>
        </g>
      ))}
      {/* Axis label */}
      <text
        stroke={bg}
        strokeWidth={2.5}
        paintOrder="stroke"
        fill={fg}
        fontSize={10}
        textAnchor="middle"
        transform={`translate(${isLeft ? -30 : 30}, ${height / 2}) rotate(-90)`}
      >
        Insert size (bp)
      </text>
    </g>
  )
})

export default CloudYScaleBar
