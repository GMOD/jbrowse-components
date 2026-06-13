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
  const { items, yTop, yBottom } = ticks
  const bg = theme.palette.background.default
  const fg = theme.palette.text.primary
  const isLeft = orientation !== 'right'
  const k = isLeft ? -1 : 1
  const tickLength = 6
  return (
    <g
      fontSize={10}
      fontFamily="sans-serif"
      textAnchor={isLeft ? 'end' : 'start'}
      stroke={fg}
      strokeWidth={1}
    >
      <path
        fill="none"
        d={`M${k * tickLength} ${yTop + 0.5}H0.5V${yBottom + 0.5}H${k * tickLength}`}
      />
      {items.map(({ value, y, label }) => (
        <g key={`${value}-${y}`} transform={`translate(0,${y})`}>
          <line x2={k * tickLength} y1={0.5} y2={0.5} />
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
