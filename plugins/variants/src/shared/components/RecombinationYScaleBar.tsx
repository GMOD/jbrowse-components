import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core'
import { useTheme } from '@mui/material'

import { Y_AXIS_WIDTH } from './recombinationConstants.ts'
const NUM_TICKS = 4

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
  const fg = theme.palette.text.primary
  const bg = theme.palette.background.default
  const plotHeight = height - 2 * YSCALEBAR_LABEL_OFFSET
  const yTop = YSCALEBAR_LABEL_OFFSET + 0.5
  const yBottom = height - YSCALEBAR_LABEL_OFFSET + 0.5

  const content = (
    <>
      <rect x={0} y={0} width={Y_AXIS_WIDTH} height={height} fill={bg} />
      <g
        fill="none"
        fontSize={9}
        fontFamily="sans-serif"
        textAnchor="end"
        strokeWidth={1}
      >
        <path
          stroke={fg}
          d={`M${Y_AXIS_WIDTH - 6},${yTop}H${Y_AXIS_WIDTH - 0.5}V${yBottom}H${Y_AXIS_WIDTH - 6}`}
        />
        {Array.from({ length: NUM_TICKS + 1 }, (_, i) => {
          const value = (maxValue * i) / NUM_TICKS
          const y = YSCALEBAR_LABEL_OFFSET + plotHeight * (1 - i / NUM_TICKS)
          return (
            <g key={value} transform={`translate(0,${y})`}>
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
                {value.toFixed(2)}
              </text>
            </g>
          )
        })}
      </g>
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
