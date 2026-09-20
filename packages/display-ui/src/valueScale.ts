import type { ScoreRuleMark } from './ScoreRules.tsx'
import type { YScaleTicks } from './yScaleTicks.ts'

export type AxisSide = 'left' | 'right'

/**
 * #api
 * One reference line a value scale declares, at a value in the scale's own
 * units. `label` is free text and carries no meaning the chrome assigns: over
 * a coverage plot "2 copies" is a claim only the author can make, since no
 * ploidy can be assumed.
 */
export interface ValueScaleRule {
  value: number
  color?: string
  label?: string
}

/**
 * #api
 * A value scale a display places its y through, declared so the chrome can
 * derive the axis from it — the score axis's counterpart to a colour scale.
 *
 * `domain` is the resolved `[min, max]`; `height` the band it rules and
 * `offset` the inset of the plot box inside that band (`axisPlotBox(height,
 * offset)`); `minimalTicks` and `symlogConstant` how the ticks are chosen.
 * `ticks` is the display's own ladder where the band's arithmetic is its own
 * (the coverage band's octaves against the shader's box, the read cloud's
 * decades against the arc geometry); `ScoreScaleMixin` derives one through
 * `computeYTicks` otherwise.
 *
 * `bandTops` is the screen y of each band the scale rules — one at 0 unless
 * the display stacks the same plot: the multi-wiggle's rows, a grouped
 * alignments track's coverage band per group, each projected through the
 * display's own scroll; the chrome drops the ones off screen. `[]` is a scale
 * the display maps to colour rather than to y (density rows each in their own
 * colour), which gets the `[min, max]` caption and no axis, as a scale whose
 * bands are too short for one does. `side` and `left` are which of the band's
 * edges the display's own panels leave clear for a gutter: `right` where a
 * group label chip takes the left, `left: n` where a dendrogram takes the
 * first `n` px. `caption` is what the scale measures (`TLEN`), as a colour
 * scale's `field` is; the chrome draws it once for the scale, beside the
 * bands on screen, however many it rules. `rules` are the reference lines the
 * scale declares, which the chrome draws across every band.
 *
 * A member describes the scale or the band it rules, never the axis — not an
 * orientation, a form, a gutter width or a font. The chrome reads a member to
 * keep off what the display put in the band, never to choose between two
 * drawings of it (ADR-109).
 */
export interface ValueScale {
  domain: [number, number] | undefined
  scaleType: string
  height: number
  offset?: number
  minimalTicks?: boolean
  symlogConstant?: number
  ticks?: YScaleTicks
  bandTops?: number[]
  side?: AxisSide
  left?: number
  caption?: string
  rules?: readonly ValueScaleRule[]
}

/**
 * A value scale whose ticks resolved: what the chrome draws. `ruleMarks` are
 * its `rules` inside the domain, each at its y in the band's pixel space.
 */
export interface YAxis extends ValueScale {
  domain: [number, number]
  ticks: YScaleTicks
  ruleMarks?: ScoreRuleMark[]
}
