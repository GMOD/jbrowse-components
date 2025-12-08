import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type axisPropsFromTickScale from './axisPropsFromTickScale'

type Ticks = ReturnType<typeof axisPropsFromTickScale>

const YScaleBar = observer(function ({
  model,
  orientation,
}: {
  model: { ticks?: Ticks }
  orientation?: string
}) {
  const { ticks } = model
  const theme = useTheme()
  if (!ticks) {
    return null
  }
  const { range, values, position } = ticks
  const bg = theme.palette.background.default
  const fg = theme.palette.text.primary
  const isLeft = orientation === 'left'
  const k = isLeft ? -1 : 1
  const range0 = range[0]! + 0.5
  const range1 = range[1]! + 0.5

  return (
    <g
      fill="none"
      fontSize={10}
      fontFamily="sans-serif"
      textAnchor={isLeft ? 'end' : 'start'}
      strokeWidth={1}
    >
      <path stroke={fg} d={`M${k * 6},${range0}H0.5V${range1}H${k * 6}`} />
      {values.map((v, idx) => {
        const pos = position(v)
        return (
          <g
            key={idx}
            transform={`translate(0,${Number.isFinite(pos) ? pos : 0})`}
          >
            <line stroke={fg} x2={k * 6} y1={0.5} y2={0.5} />
            <text
              stroke={bg}
              strokeWidth={2.5}
              paintOrder="stroke"
              fill={fg}
              dy="0.32em"
              x={k * 9}
              y={0.5}
            >
              {v}
            </text>
          </g>
        )
      })}
    </g>
  )
})

export default YScaleBar
