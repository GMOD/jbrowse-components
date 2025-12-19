import type { LegendItem } from './components/FloatingLegend'

export default function SVGLegend({
  items,
  width,
}: {
  items: LegendItem[]
  width: number
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

  const x = width - legendWidth - 10
  const y = 10

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={0}
        y={0}
        width={legendWidth}
        height={legendHeight}
        fill="rgba(255,255,255,0.7)"
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
