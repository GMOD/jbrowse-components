import { formatScore } from '../util.ts'
import { makeDensityRgbStringFn } from './getDensityColor.ts'
import { measureLegendText } from './measureLegendText.ts'

// Density mode spends color on the score, so `[min, max]` alone says which
// numbers are in play but not which end is which color, nor where the pivot
// (the value drawn white) sits between them. `ramp` adds the missing half: a
// bar sampled from the actual color function, so the picture and the legend
// cannot disagree.
export interface ScoreRamp {
  posColor: string
  negColor: string
  pivot: number
}

const BAR_WIDTH = 110
const BAR_HEIGHT = 8
const LABEL_SIZE = 10

function hexToRgb(hex: string) {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

// Sampled rather than a three-stop gradient. The painted color is
// `|norm(score) - norm(pivot)| / max(norm(pivot), 1 - norm(pivot))`, which is
// piecewise linear with a different slope each side of an off-center pivot: at
// domain 0..6 with the pivot at 2, the loss side tops out at half saturation.
// A hand-written neg-white-pos gradient would show both ends fully saturated
// and so overstate the short side.
function rampStops(domain: [number, number], ramp: ScoreRamp, isLog: boolean) {
  const [min, max] = domain
  const [pr, pg, pb] = hexToRgb(ramp.posColor)
  const [nr, ng, nb] = hexToRgb(ramp.negColor)
  const pos = makeDensityRgbStringFn(min, max, isLog, pr, pg, pb, ramp.pivot)
  const neg = makeDensityRgbStringFn(min, max, isLog, nr, ng, nb, ramp.pivot)
  const steps = 16
  return Array.from({ length: steps + 1 }, (_, i) => {
    const offset = i / steps
    const score = min + (max - min) * offset
    return { offset, color: score < ramp.pivot ? neg(score) : pos(score) }
  })
}

export default function ScoreLegend({
  domain,
  scaleType,
  canvasWidth,
  ramp,
  gradientId,
}: {
  domain: [number, number]
  scaleType: string
  canvasWidth: number
  // omitted outside density mode, and when rows carry their own colors (there
  // is then no single ramp to draw)
  ramp?: ScoreRamp
  // unique per display, so two density tracks in one view don't share a def
  gradientId?: string
}) {
  const isLog = scaleType === 'log'
  const suffix = isLog ? ' (log)' : ''
  if (!ramp || !gradientId) {
    const legend = `[${formatScore(domain[0])}, ${formatScore(domain[1])}]${suffix}`
    const len = measureLegendText(legend, 12)
    const xpos = Math.max(0, canvasWidth - len - 10)
    return (
      <g>
        <rect
          x={xpos - 3}
          y={0}
          width={len + 6}
          height={16}
          fill="rgba(255,255,255,0.8)"
        />
        <text y={12} x={xpos} fontSize={12}>
          {legend}
        </text>
      </g>
    )
  }

  const [min, max] = domain
  const labels = [min, ramp.pivot, max].map(v => formatScore(v))
  const widest = Math.max(...labels.map(l => measureLegendText(l, LABEL_SIZE)))
  const boxWidth = BAR_WIDTH + widest
  const xpos = Math.max(0, canvasWidth - boxWidth - 10)
  // where the pivot sits along the bar, so the white point is labeled where it
  // actually falls rather than at the middle
  const pivotFrac = (ramp.pivot - min) / (max - min)
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          {rampStops(domain, ramp, isLog).map(s => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={xpos - 3}
        y={0}
        width={boxWidth + 6}
        height={BAR_HEIGHT + LABEL_SIZE + 8}
        fill="rgba(255,255,255,0.8)"
      />
      <rect
        x={xpos}
        y={3}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
        fill={`url(#${gradientId})`}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={0.5}
      />
      <text x={xpos} y={BAR_HEIGHT + LABEL_SIZE + 4} fontSize={LABEL_SIZE}>
        {labels[0]}
      </text>
      <text
        x={xpos + BAR_WIDTH * pivotFrac}
        y={BAR_HEIGHT + LABEL_SIZE + 4}
        fontSize={LABEL_SIZE}
        textAnchor="middle"
      >
        {labels[1]}
      </text>
      <text
        x={xpos + BAR_WIDTH}
        y={BAR_HEIGHT + LABEL_SIZE + 4}
        fontSize={LABEL_SIZE}
        textAnchor="end"
      >
        {`${labels[2]}${suffix}`}
      </text>
    </g>
  )
}
