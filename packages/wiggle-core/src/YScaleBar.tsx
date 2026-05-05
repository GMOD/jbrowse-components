import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { YScaleTicks } from './index.ts'

const YScaleBar = observer(function YScaleBar({
  ticks,
  orientation,
}: {
  ticks: YScaleTicks | undefined
  orientation?: 'left' | 'right'
}) {
  const theme = useTheme()
  if (!ticks) {
    return null
  }
  const { ticks: items, yTop, yBottom } = ticks
  const bg = theme.palette.background.default
  const fg = theme.palette.text.primary
  const isLeft = orientation !== 'right'
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
      <path
        stroke={fg}
        d={`M${k * tickLength},${yTop}H0.5V${yBottom}H${k * tickLength}`}
      />
      {items.map(({ value, y, label }) => (
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
            {label ?? value}
          </text>
        </g>
      ))}
    </g>
  )
})

export default YScaleBar
