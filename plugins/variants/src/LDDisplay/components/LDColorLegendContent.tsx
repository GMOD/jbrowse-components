import {
  BAR_HEIGHT,
  BAR_WIDTH,
  FONT_SIZE,
  LEGEND_HEIGHT,
  LEGEND_WIDTH,
  PADDING,
} from './const.ts'
import { getColorStops } from './getColorStops.ts'

function getLabels(ldMetric: string, signedLD: boolean) {
  if (signedLD) {
    return {
      min: '-1',
      max: '1',
      metric: ldMetric === 'dprime' ? "D'" : 'R',
    }
  }
  return {
    min: '0',
    max: '1',
    metric: ldMetric === 'dprime' ? "D'" : 'R²',
  }
}

export default function LDColorLegendContent({
  ldMetric,
  signedLD = false,
  x = 0,
  y = 0,
}: {
  ldMetric: string
  signedLD?: boolean
  x?: number
  y?: number
}) {
  const gradientId = `ld-gradient-${ldMetric}-${signedLD ? 'signed' : 'unsigned'}`
  const stops = getColorStops(ldMetric, signedLD)
  const labels = getLabels(ldMetric, signedLD)

  return (
    <g transform={`translate(${x}, ${y})`}>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {stops.map((stop, idx) => (
            <stop
              // eslint-disable-next-line @eslint-react/no-array-index-key -- static gradient stops from a fixed palette, never reordered
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
        width={LEGEND_WIDTH}
        height={LEGEND_HEIGHT}
        fill="rgba(255,255,255,0.9)"
        stroke="#ccc"
        strokeWidth={1}
        rx={4}
      />
      <rect
        x={PADDING}
        y={PADDING}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
        fill={`url(#${gradientId})`}
        rx={2}
      />
      <text
        x={PADDING}
        y={PADDING + BAR_HEIGHT + FONT_SIZE + 2}
        fontSize={FONT_SIZE}
        fill="black"
      >
        {labels.min}
      </text>
      <text
        x={PADDING + BAR_WIDTH / 2}
        y={PADDING + BAR_HEIGHT + FONT_SIZE + 2}
        fontSize={FONT_SIZE}
        fill="black"
        textAnchor="middle"
      >
        {labels.metric}
      </text>
      <text
        x={PADDING + BAR_WIDTH}
        y={PADDING + BAR_HEIGHT + FONT_SIZE + 2}
        fontSize={FONT_SIZE}
        fill="black"
        textAnchor="end"
      >
        {labels.max}
      </text>
    </g>
  )
}
