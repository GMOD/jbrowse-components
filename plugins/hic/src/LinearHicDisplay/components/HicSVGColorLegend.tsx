import { toLocale } from '@jbrowse/core/util'
import { scaleLinear, scaleLog } from '@mui/x-charts-vendor/d3-scale'

const colorStops: Record<string, { offset: string; color: string }[]> = {
  juicebox: [
    { offset: '0%', color: 'rgba(0,0,0,0)' },
    { offset: '100%', color: 'red' },
  ],
  fall: [
    { offset: '0%', color: 'rgb(255,255,255)' },
    { offset: '10%', color: 'rgb(255,255,204)' },
    { offset: '20%', color: 'rgb(255,237,160)' },
    { offset: '30%', color: 'rgb(254,217,118)' },
    { offset: '40%', color: 'rgb(254,178,76)' },
    { offset: '50%', color: 'rgb(253,141,60)' },
    { offset: '60%', color: 'rgb(252,78,42)' },
    { offset: '70%', color: 'rgb(227,26,28)' },
    { offset: '80%', color: 'rgb(189,0,38)' },
    { offset: '90%', color: 'rgb(128,0,38)' },
    { offset: '100%', color: 'rgb(0,0,0)' },
  ],
  viridis: [
    { offset: '0%', color: '#440154' },
    { offset: '11%', color: '#482878' },
    { offset: '22%', color: '#3e4a89' },
    { offset: '33%', color: '#31688e' },
    { offset: '44%', color: '#26828e' },
    { offset: '55%', color: '#1f9e89' },
    { offset: '66%', color: '#35b779' },
    { offset: '77%', color: '#6ece58' },
    { offset: '88%', color: '#b5de2b' },
    { offset: '100%', color: '#fde725' },
  ],
}

function getNiceScale(maxScore: number, useLogScale?: boolean) {
  if (useLogScale) {
    // Use base 2 for log scale like wiggle plugin does
    const scale = scaleLog().base(2).domain([1, maxScore]).nice()
    const [min, max] = scale.domain()
    return { min, max }
  }
  const scale = scaleLinear().domain([0, maxScore]).nice()
  const [min, max] = scale.domain()
  return { min, max }
}

export default function HicSVGColorLegend({
  maxScore,
  colorScheme = 'juicebox',
  useLogScale,
  width,
  legendAreaWidth,
}: {
  maxScore: number
  colorScheme?: string
  useLogScale?: boolean
  width: number
  legendAreaWidth?: number
}) {
  const gradientId = `hic-gradient-${colorScheme}`
  const stops = colorStops[colorScheme] || colorStops.juicebox!
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
  const x = legendAreaWidth ? width + 10 : width - legendWidth - 10
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
