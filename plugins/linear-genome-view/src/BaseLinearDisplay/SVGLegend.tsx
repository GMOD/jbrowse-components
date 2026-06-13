import { stripAlpha } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import {
  LEGEND_BOX_SIZE,
  LEGEND_FONT_SIZE,
  LEGEND_PADDING,
  legendBoxWidth,
} from './calculateSvgLegendWidth.ts'

import type { LegendItem } from './components/FloatingLegend.tsx'

export default function SVGLegend({
  items,
  width,
  legendAreaWidth,
}: {
  items: LegendItem[]
  width: number
  legendAreaWidth?: number
}) {
  const theme = useTheme()
  if (items.length === 0) {
    return null
  }

  const itemHeight = LEGEND_BOX_SIZE + 2
  const legendWidth = legendBoxWidth(items)
  const legendHeight = items.length * itemHeight + LEGEND_PADDING * 2
  const x = legendAreaWidth ? width + 10 : width - legendWidth - 10

  return (
    <g transform={`translate(${x}, 10)`}>
      <rect
        x={0}
        y={0}
        width={legendWidth}
        height={legendHeight}
        fill={stripAlpha(theme.palette.background.paper)}
        stroke={stripAlpha(theme.palette.divider)}
        strokeWidth={1}
        rx={4}
      />
      {items.map((item, idx) => (
        <g
          key={item.label}
          transform={`translate(${LEGEND_PADDING}, ${LEGEND_PADDING + idx * itemHeight})`}
        >
          {item.color ? (
            <rect
              x={0}
              y={0}
              width={LEGEND_BOX_SIZE}
              height={LEGEND_BOX_SIZE}
              fill={item.color}
            />
          ) : null}
          <text
            x={LEGEND_BOX_SIZE + 6}
            y={LEGEND_BOX_SIZE - 2}
            fontSize={LEGEND_FONT_SIZE}
            fill={stripAlpha(theme.palette.text.primary)}
          >
            {item.label}
          </text>
        </g>
      ))}
    </g>
  )
}
