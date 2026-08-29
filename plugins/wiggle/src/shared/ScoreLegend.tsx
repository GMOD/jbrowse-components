import { svgSafeId } from '@jbrowse/core/svg/svgId'
import { measureLegendText } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { stripAlpha } from '@jbrowse/core/util'
import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import { scaleTypeFromString } from '@jbrowse/wiggle-core'

import { formatScore } from '../util.ts'
import {
  makeDensityLutFillFn,
  makeDensityRgbStringFn,
} from './getDensityColor.ts'

import type { WiggleScaleType } from '@jbrowse/wiggle-core'

// Density mode spends color on the score, so `[min, max]` alone says which
// numbers are in play but not which end is which color, nor where the pivot
// (the value drawn white) sits between them. `ramp` adds the missing half: a
// bar sampled from the actual color function, so the picture and the legend
// cannot disagree.
export interface ScoreRamp {
  posColor: string
  negColor: string
  pivot: number
  // the resolved densityColorRamp LUT — the same cached bytes both renderers
  // color through — or null for the default white→track-color fade. Required
  // rather than optional so a new producer can't quietly leave the legend on
  // the default fade while the track paints a named ramp, which is exactly how
  // this field was born.
  rampLut: Uint8Array | null
  // unique per display, so two density tracks in one view don't share a def.
  // Bundled with the colors rather than passed alongside them, so a caller
  // can't supply half a ramp.
  gradientId: string
}

// the bar's minimum width; it grows if the end labels need more room
const MIN_BAR_WIDTH = 110
const BAR_HEIGHT = 8
const LABEL_SIZE = 10
const TEXT_LEGEND_HEIGHT = 16
const RAMP_LEGEND_HEIGHT = BAR_HEIGHT + LABEL_SIZE + 8

// Vertical space the legend needs, for the on-screen path, whose <svg> wrapper
// clips to its own height — the ramp is taller than the one-line text.
export function scoreLegendHeight(ramp: ScoreRamp | undefined) {
  return ramp ? RAMP_LEGEND_HEIGHT : TEXT_LEGEND_HEIGHT
}

// Sampled from the live color function rather than a three-stop gradient. The
// painted position is `|norm(score) - norm(pivot)| / max(norm(pivot), 1 -
// norm(pivot))`, which is piecewise linear with a different slope each side of
// an off-center pivot: at domain 0..6 with the pivot at 2, the loss side tops
// out at half saturation. A hand-written neg-white-pos gradient would show
// both ends fully saturated and so overstate the short side. A named ramp
// (`rampLut`) goes through the same score → t chain into the same LUT bytes
// the renderers index, so each stop is verbatim a render LUT entry and the
// pivot sits on LUT[0].
function rampStops(
  domain: [number, number],
  ramp: ScoreRamp,
  scaleType: WiggleScaleType,
  symlogConstant: number,
) {
  const [min, max] = domain
  let colorAt: (score: number) => string
  if (ramp.rampLut) {
    colorAt = makeDensityLutFillFn(
      min,
      max,
      scaleType,
      ramp.rampLut,
      ramp.pivot,
      symlogConstant,
    )
  } else {
    const [pr, pg, pb] = cssColorToRgb(ramp.posColor)
    const [nr, ng, nb] = cssColorToRgb(ramp.negColor)
    const pos = makeDensityRgbStringFn(
      min,
      max,
      scaleType,
      pr,
      pg,
      pb,
      ramp.pivot,
      symlogConstant,
    )
    const neg = makeDensityRgbStringFn(
      min,
      max,
      scaleType,
      nr,
      ng,
      nb,
      ramp.pivot,
      symlogConstant,
    )
    colorAt = score => (score < ramp.pivot ? neg(score) : pos(score))
  }
  const steps = 16
  return Array.from({ length: steps + 1 }, (_, i) => {
    const offset = i / steps
    return { offset, color: colorAt(min + (max - min) * offset) }
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
  const palette = usePalette()
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
        fill={stripAlpha(palette.background.paper)}
        fillOpacity={0.8}
      />
      <text y={12} x={xpos} fontSize={12} fill={palette.text.primary}>
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
  scaleType,
  symlogConstant,
}: {
  domain: [number, number]
  suffix: string
  canvasWidth: number
  ramp: ScoreRamp
  scaleType: WiggleScaleType
  symlogConstant: number
}) {
  const palette = usePalette()
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
  // hand-rolled rather than SvgGradientLegend (this bar is sampled from the
  // live color function), so it owns the sanitizing that component does:
  // gradientId is built from the displayId, which is arbitrary config text
  const gradientId = svgSafeId(ramp.gradientId)
  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
          {rampStops(domain, ramp, scaleType, symlogConstant).map(s => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={xpos - 3}
        y={0}
        width={barWidth + 6}
        height={RAMP_LEGEND_HEIGHT}
        fill={stripAlpha(palette.background.paper)}
        fillOpacity={0.8}
      />
      <rect
        x={xpos}
        y={3}
        width={barWidth}
        height={BAR_HEIGHT}
        fill={`url(#${gradientId})`}
        stroke={stripAlpha(palette.text.primary)}
        strokeOpacity={0.25}
        strokeWidth={0.5}
      />
      {pivotX === undefined ? null : (
        <line
          x1={xpos + pivotX}
          x2={xpos + pivotX}
          y1={3}
          y2={3 + BAR_HEIGHT}
          stroke={stripAlpha(palette.text.primary)}
          strokeOpacity={0.4}
          strokeWidth={0.5}
        />
      )}
      <text
        x={xpos}
        y={labelY}
        fontSize={LABEL_SIZE}
        fill={palette.text.primary}
      >
        {minLabel}
      </text>
      {labelPivot ? (
        <text
          x={xpos + pivotX}
          y={labelY}
          fontSize={LABEL_SIZE}
          textAnchor="middle"
          fill={palette.text.primary}
        >
          {pivotLabel}
        </text>
      ) : null}
      <text
        x={xpos + barWidth}
        y={labelY}
        fontSize={LABEL_SIZE}
        textAnchor="end"
        fill={palette.text.primary}
      >
        {maxLabel}
      </text>
    </g>
  )
}

export default function ScoreLegend({
  domain,
  scaleType,
  symlogConstant,
  canvasWidth,
  ramp,
}: {
  domain: [number, number]
  scaleType: string
  // The resolved constant off `renderState`, not the raw config slot: `0` there
  // means "derive from the domain", and a legend deriving its own would draw a
  // different curve from the one the backends were handed. Required, so a new
  // call site cannot quietly reintroduce that.
  symlogConstant: number
  canvasWidth: number
  // omitted outside density mode, and when rows carry their own colors (there
  // is then no single ramp to draw)
  ramp?: ScoreRamp
}) {
  const isLog = scaleType === 'log'
  const suffix = isLog ? ' (log)' : scaleType === 'symlog' ? ' (symlog)' : ''
  return ramp ? (
    <ScoreRampLegend
      domain={domain}
      suffix={suffix}
      canvasWidth={canvasWidth}
      ramp={ramp}
      scaleType={scaleTypeFromString(scaleType)}
      symlogConstant={symlogConstant}
    />
  ) : (
    <ScoreTextLegend
      domain={domain}
      suffix={suffix}
      canvasWidth={canvasWidth}
    />
  )
}
