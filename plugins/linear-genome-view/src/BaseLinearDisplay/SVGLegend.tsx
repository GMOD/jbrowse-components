import type { LegendItem } from './components/FloatingLegend'

/**
 * Calculate the width needed for an SVG legend based on the legend items.
 * Used by SVG export to add extra width for the legend area.
 */
export function calculateSvgLegendWidth(items: LegendItem[]): number {
  if (items.length === 0) {
    return 0
  }
  const boxSize = 12
  const padding = 3
  const maxLabelWidth = Math.max(...items.map(item => item.label.length * 6))
  return boxSize + 8 + maxLabelWidth + padding * 2 + 20
}

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

  const boxSize = 12
  const fontSize = 10
  const padding = 3
  const itemHeight = boxSize + 2
  const legendHeight = items.length * itemHeight + padding * 2

  // Calculate legend width based on longest label
  const maxLabelWidth = Math.max(...items.map(item => item.label.length * 6))
  const legendWidth = boxSize + 8 + maxLabelWidth + padding * 2

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
          transform={`translate(${padding}, ${padding + idx * itemHeight})`}
        >
          {item.color ? (
            <rect
              x={0}
              y={0}
              width={boxSize}
              height={boxSize}
              fill={item.color}
            />
          ) : null}
          <text
            x={boxSize + 6}
            y={boxSize - 2}
            fontSize={fontSize}
            fill="black"
          >
            {item.label}
          </text>
        </g>
      ))}
    </g>
  )
}
