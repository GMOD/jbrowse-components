/**
 * Unified SVG-based color legend for LD displays.
 * Used both in the React app (with SVG wrapper) and SVG export (without wrapper).
 */

const LEGEND_WIDTH = 120
const LEGEND_HEIGHT = 40
const BAR_WIDTH = 100
const BAR_HEIGHT = 12
const PADDING = 8
const FONT_SIZE = 10

function getColorStops(ldMetric: string, signedLD: boolean) {
  if (signedLD) {
    if (ldMetric === 'dprime') {
      // Green (negative) -> White (zero) -> Blue (positive)
      return [
        { offset: '0%', color: 'rgb(0,100,0)' },
        { offset: '25%', color: 'rgb(64,192,64)' },
        { offset: '50%', color: 'rgb(255,255,255)' },
        { offset: '75%', color: 'rgb(128,128,255)' },
        { offset: '100%', color: 'rgb(0,0,160)' },
      ]
    }
    // Blue (negative) -> White (zero) -> Red (positive)
    return [
      { offset: '0%', color: 'rgb(0,0,160)' },
      { offset: '25%', color: 'rgb(128,128,255)' },
      { offset: '50%', color: 'rgb(255,255,255)' },
      { offset: '75%', color: 'rgb(255,128,128)' },
      { offset: '100%', color: 'rgb(160,0,0)' },
    ]
  }
  if (ldMetric === 'dprime') {
    return [
      { offset: '0%', color: 'rgb(255,255,255)' },
      { offset: '50%', color: 'rgb(128,128,255)' },
      { offset: '100%', color: 'rgb(0,0,160)' },
    ]
  }
  return [
    { offset: '0%', color: 'rgb(255,255,255)' },
    { offset: '50%', color: 'rgb(255,128,128)' },
    { offset: '100%', color: 'rgb(160,0,0)' },
  ]
}

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

/**
 * The core SVG legend content (without the outer <svg> element).
 * Used directly in SVG export and wrapped in <svg> for React app.
 */
export function LDColorLegendContent({
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

/**
 * Wrapper for use in SVG export - positions the legend in the top-right corner.
 */
export function LDSVGColorLegend({
  ldMetric,
  width,
  signedLD = false,
}: {
  ldMetric: string
  width: number
  signedLD?: boolean
}) {
  const x = width - LEGEND_WIDTH - 10
  const y = 10
  return (
    <LDColorLegendContent ldMetric={ldMetric} signedLD={signedLD} x={x} y={y} />
  )
}

/**
 * Wrapper for use in React app - wraps the SVG content in an absolutely positioned SVG element.
 */
export default function LDColorLegend({
  ldMetric,
  signedLD = false,
}: {
  ldMetric: string
  signedLD?: boolean
}) {
  return (
    <svg
      style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: LEGEND_WIDTH,
        height: LEGEND_HEIGHT,
        zIndex: 10,
        overflow: 'visible',
      }}
    >
      <LDColorLegendContent ldMetric={ldMetric} signedLD={signedLD} />
    </svg>
  )
}
