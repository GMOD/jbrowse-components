import { toLocale } from '@jbrowse/core/util'
import { getNiceScale } from '@jbrowse/wiggle-core'

import {
  DEFAULT_HIC_COLOR_SCHEME,
  type HicColorScheme,
  getLegendSvgStops,
} from './colorRamp.ts'

export default function HicSVGColorLegend({
  maxScore,
  colorScheme,
  useLogScale,
  width,
  legendAreaWidth,
}: {
  maxScore: number
  colorScheme?: HicColorScheme
  useLogScale?: boolean
  width: number
  legendAreaWidth?: number
}) {
  const resolvedScheme = colorScheme ?? DEFAULT_HIC_COLOR_SCHEME
  const gradientId = `hic-gradient-${resolvedScheme}`
  const stops = getLegendSvgStops(resolvedScheme)
  const { min, max } = getNiceScale(maxScore, useLogScale)
  const minLabel = min !== undefined ? toLocale(min) : ''
  const maxLabel = `${max !== undefined ? toLocale(max) : ''}${useLogScale ? ' (log)' : ''}`

  const legendWidth = 120
  const legendHeight = 40
  const barWidth = 100
  const barHeight = 12
  const padding = 8
  const fontSize = 10

  // Position legend to the right if legendAreaWidth is provided, otherwise top-right inside
  const x =
    legendAreaWidth !== undefined ? width + 10 : width - legendWidth - 10
  const y = 10

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
        {minLabel}
      </text>
      <text
        x={padding + barWidth}
        y={padding + barHeight + fontSize + 2}
        fontSize={fontSize}
        fill="black"
        textAnchor="end"
      >
        {maxLabel}
      </text>
    </g>
  )
}
