import { measureText } from '@jbrowse/core/util'

import type { LegendItem } from './components/FloatingLegend.tsx'

const LEGEND_FONT_SIZE = 10
const LEGEND_BOX_SIZE = 12
const LEGEND_PADDING = 3

export default function SVGLegend({
  items,
  width,
  legendAreaWidth,
}: {
  items: LegendItem[]
  width: number
  legendAreaWidth?: number
}) {
  if (items.length === 0) {
    return null
  }

  const itemHeight = LEGEND_BOX_SIZE + 2
  const legendHeight = items.length * itemHeight + LEGEND_PADDING * 2

  // Calculate legend width based on longest label
  const maxLabelWidth = Math.max(
    ...items.map(item => measureText(item.label, LEGEND_FONT_SIZE)),
  )
  const legendWidth = LEGEND_BOX_SIZE + 8 + maxLabelWidth + LEGEND_PADDING * 2

  // If legendAreaWidth is provided, position legend to the right of the figure
  // Otherwise, position it inside the figure area (top-right corner)
  const x = legendAreaWidth ? width + 10 : width - legendWidth - 10
  const y = 10

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={0}
        width={legendWidth}
        height={legendHeight}
        fill="rgba(255,255,255,0.9)"
        stroke="#ccc"
        strokeWidth={1}
        rx={4}
      />
      {items.map((item, idx) => (
        <g
          key={`legend-${idx}`}
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
            fill="black"
          >
            {item.label}
          </text>
        </g>
      ))}
    </g>
  )
}
