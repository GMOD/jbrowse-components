export default function LDSVGColorLegend({
  ldMetric,
  width,
}: {
  ldMetric: string
  width: number
}) {
  const gradientId = `ld-gradient-${ldMetric}`

  // Color stops based on metric
  const stops =
    ldMetric === 'dprime'
      ? [
          { offset: '0%', color: 'rgb(255,255,255)' },
          { offset: '50%', color: 'rgb(128,128,255)' },
          { offset: '100%', color: 'rgb(0,0,160)' },
        ]
      : [
          { offset: '0%', color: 'rgb(255,255,255)' },
          { offset: '50%', color: 'rgb(255,128,128)' },
          { offset: '100%', color: 'rgb(160,0,0)' },
        ]

  const legendWidth = 120
  const legendHeight = 40
  const barWidth = 100
  const barHeight = 12
  const padding = 8
  const fontSize = 10

  // Always position legend to the right of the image for SVG export
  const x = width + 10
  const y = 10

  const label = ldMetric === 'dprime' ? "D'" : 'R²'

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((stop, idx) => (
            <stop
              key={idx}
              offset={stop.offset}
              style={{ stopColor: stop.color, stopOpacity: 1 }}
            />
          ))}
        </linearGradient>
      </defs>
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
      <rect
        x={padding}
        y={padding}
        width={barWidth}
        height={barHeight}
        fill={`url(#${gradientId})`}
        rx={2}
      />
      <text
        x={padding}
        y={padding + barHeight + fontSize + 2}
        fontSize={fontSize}
        fill="black"
      >
        0
      </text>
      <text
        x={padding + barWidth / 2}
        y={padding + barHeight + fontSize + 2}
        fontSize={fontSize}
        fill="black"
        textAnchor="middle"
      >
        {label}
      </text>
      <text
        x={padding + barWidth}
        y={padding + barHeight + fontSize + 2}
        fontSize={fontSize}
        fill="black"
        textAnchor="end"
      >
        1
      </text>
    </g>
  )
}
