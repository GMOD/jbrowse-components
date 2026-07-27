import { measureLegendText } from '@jbrowse/core/ui'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'

import { formatScore } from '../util.ts'
import { makeDensityRgbStringFn } from './getDensityColor.ts'

// Density mode spends color on the score, so `[min, max]` alone says which
// numbers are in play but not which end is which color, nor where the pivot
// (the value drawn white) sits between them. `ramp` adds the missing half: a
// bar sampled from the actual color function, so the picture and the legend
// cannot disagree.
export interface ScoreRamp {
  posColor: string
  negColor: string
  pivot: number
  // unique per display, so two density tracks in one view don't share a def.
  // Bundled with the colors rather than passed alongside them, so a caller
  // can't supply half a ramp.
  gradientId: string
}

// the bar's minimum width; it grows if the end labels need more room
const MIN_BAR_WIDTH = 110
const BAR_HEIGHT = 8
const LABEL_SIZE = 10
const PAPER = 'rgba(255,255,255,0.8)'
const TEXT_LEGEND_HEIGHT = 16
const RAMP_LEGEND_HEIGHT = BAR_HEIGHT + LABEL_SIZE + 8

// Vertical space the legend needs, for the on-screen path, whose <svg> wrapper
// clips to its own height — the ramp is taller than the one-line text.
export function scoreLegendHeight(ramp: ScoreRamp | undefined) {
  return ramp ? RAMP_LEGEND_HEIGHT : TEXT_LEGEND_HEIGHT
}

// Sampled rather than a three-stop gradient. The painted color is
// `|norm(score) - norm(pivot)| / max(norm(pivot), 1 - norm(pivot))`, which is
// piecewise linear with a different slope each side of an off-center pivot: at
// domain 0..6 with the pivot at 2, the loss side tops out at half saturation.
// A hand-written neg-white-pos gradient would show both ends fully saturated
// and so overstate the short side.
function rampStops(domain: [number, number], ramp: ScoreRamp, isLog: boolean) {
  const [min, max] = domain
  const [pr, pg, pb] = cssColorToRgb(ramp.posColor)
  const [nr, ng, nb] = cssColorToRgb(ramp.negColor)
  const pos = makeDensityRgbStringFn(min, max, isLog, pr, pg, pb, ramp.pivot)
  const neg = makeDensityRgbStringFn(min, max, isLog, nr, ng, nb, ramp.pivot)
  const steps = 16
  return Array.from({ length: steps + 1 }, (_, i) => {
    const offset = i / steps
    const score = min + (max - min) * offset
    return { offset, color: score < ramp.pivot ? neg(score) : pos(score) }
  })
}

// The plain domain text, for every mode that encodes score as height.
function ScoreTextLegend({
  domain,
  suffix,
  canvasWidth,
}: {
  domain: [number, number]
  suffix: string
  canvasWidth: number
}) {
  const legend = `[${formatScore(domain[0])}, ${formatScore(domain[1])}]${suffix}`
  const len = measureLegendText(legend, 12)
  const xpos = Math.max(0, canvasWidth - len - 10)
  return (
    <g>
      <rect
        x={xpos - 3}
        y={0}
        width={len + 6}
        height={TEXT_LEGEND_HEIGHT}
        fill={PAPER}
      />
      <text y={12} x={xpos} fontSize={12}>
        {legend}
      </text>
    </g>
  )
}

function ScoreRampLegend({
  domain,
  suffix,
  canvasWidth,
  ramp,
  isLog,
}: {
  domain: [number, number]
  suffix: string
  canvasWidth: number
  ramp: ScoreRamp
  isLog: boolean
}) {
  const [min, max] = domain
  const minLabel = formatScore(min)
  const maxLabel = `${formatScore(max)}${suffix}`
  const pivotLabel = formatScore(ramp.pivot)
  const wMin = measureLegendText(minLabel, LABEL_SIZE)
  const wMax = measureLegendText(maxLabel, LABEL_SIZE)
  const wPivot = measureLegendText(pivotLabel, LABEL_SIZE)
  // grow past the minimum only when the two end labels would otherwise collide
  const barWidth = Math.max(MIN_BAR_WIDTH, wMin + wMax + 6)
  const xpos = Math.max(0, canvasWidth - barWidth - 10)

  // Where the pivot sits along the bar, so the white point is marked where it
  // actually falls rather than at the middle. Undefined when it isn't on the bar
  // at all: a degenerate domain has no bar to place it on, and all-positive data
  // pivoted at 0 (the default) puts it exactly on the min end, where a second
  // label would just overprint the first.
  const pivotX =
    max > min && ramp.pivot > min && ramp.pivot < max
      ? (barWidth * (ramp.pivot - min)) / (max - min)
      : undefined
  // The tick alone carries the position when the number can't fit between the
  // end labels — squeezed that tightly it is within rounding of one of them.
  const labelPivot =
    pivotX !== undefined &&
    pivotX - wPivot / 2 > wMin &&
    pivotX + wPivot / 2 < barWidth - wMax
  const labelY = BAR_HEIGHT + LABEL_SIZE + 4
  return (
    <g>
      <defs>
        <linearGradient id={ramp.gradientId} x1="0" x2="1" y1="0" y2="0">
          {rampStops(domain, ramp, isLog).map(s => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={xpos - 3}
        y={0}
        width={barWidth + 6}
        height={RAMP_LEGEND_HEIGHT}
        fill={PAPER}
      />
      <rect
        x={xpos}
        y={3}
        width={barWidth}
        height={BAR_HEIGHT}
        fill={`url(#${ramp.gradientId})`}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={0.5}
      />
      {pivotX === undefined ? null : (
        <line
          x1={xpos + pivotX}
          x2={xpos + pivotX}
          y1={3}
          y2={3 + BAR_HEIGHT}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={0.5}
        />
      )}
      <text x={xpos} y={labelY} fontSize={LABEL_SIZE}>
        {minLabel}
      </text>
      {labelPivot ? (
        <text
          x={xpos + pivotX}
          y={labelY}
          fontSize={LABEL_SIZE}
          textAnchor="middle"
        >
          {pivotLabel}
        </text>
      ) : null}
      <text
        x={xpos + barWidth}
        y={labelY}
        fontSize={LABEL_SIZE}
        textAnchor="end"
      >
        {maxLabel}
      </text>
    </g>
  )
}

export default function ScoreLegend({
  domain,
  scaleType,
  canvasWidth,
  ramp,
}: {
  domain: [number, number]
  scaleType: string
  canvasWidth: number
  // omitted outside density mode, and when rows carry their own colors (there
  // is then no single ramp to draw)
  ramp?: ScoreRamp
}) {
  const isLog = scaleType === 'log'
  const suffix = isLog ? ' (log)' : ''
  return ramp ? (
    <ScoreRampLegend
      domain={domain}
      suffix={suffix}
      canvasWidth={canvasWidth}
      ramp={ramp}
      isLog={isLog}
    />
  ) : (
    <ScoreTextLegend
      domain={domain}
      suffix={suffix}
      canvasWidth={canvasWidth}
    />
  )
}
