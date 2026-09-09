import { cssColorToRgb } from '@jbrowse/core/util/colorBits'
import {
  resolveSymlogConstant,
  scaleTypeFromString,
} from '@jbrowse/wiggle-core'

import { formatScore } from '../util.ts'
import {
  makeDensityLutFillFn,
  makeDensityRgbStringFn,
} from './getDensityColor.ts'

import type { RampScale } from '@jbrowse/core/ui/colorScale'

// Density mode spends color on the score, so `[min, max]` alone says which
// numbers are in play but not which end is which color, nor where the pivot
// (the value drawn white) sits between them. The ramp adds the missing half:
// a bar sampled from the actual color function, so the picture and the key
// cannot disagree.
export interface ScoreRamp {
  posColor: string
  negColor: string
  pivot: number
  // the resolved densityColorRamp LUT — the same cached bytes both renderers
  // color through — or null for the default white→track-color fade. Required
  // rather than optional so a new producer can't quietly leave the key on the
  // default fade while the track paints a named ramp, which is exactly how
  // this field was born.
  rampLut: Uint8Array | null
}

const STEPS = 16

/**
 * The density ramp as a `RampScale`, sampled from the live color function
 * rather than a three-stop gradient. The painted position is
 * `|norm(score) - norm(pivot)| / max(norm(pivot), 1 - norm(pivot))`, which is
 * piecewise linear with a different slope each side of an off-center pivot: at
 * domain 0..6 with the pivot at 2, the loss side tops out at half saturation.
 * A hand-written neg-white-pos gradient would show both ends fully saturated
 * and so overstate the short side. A named ramp (`rampLut`) goes through the
 * same score → t chain into the same LUT bytes the renderers index, so each
 * stop is verbatim a render LUT entry and the pivot sits on LUT[0].
 *
 * `symlogConstant` is the raw slot: `0` there means "derive from the domain",
 * and this resolves it the way the backends do, so the bar cannot draw a
 * different curve from the one they were handed.
 */
export function scoreRampScale(
  domain: [number, number],
  scaleType: string,
  symlogConstant: number,
  ramp: ScoreRamp,
): RampScale {
  const [min, max] = domain
  const type = scaleTypeFromString(scaleType)
  const c = resolveSymlogConstant(min, max, symlogConstant)
  let colorAt: (score: number) => string
  if (ramp.rampLut) {
    colorAt = makeDensityLutFillFn(min, max, type, ramp.rampLut, ramp.pivot, c)
  } else {
    const [pr, pg, pb] = cssColorToRgb(ramp.posColor)
    const [nr, ng, nb] = cssColorToRgb(ramp.negColor)
    const pos = makeDensityRgbStringFn(
      min,
      max,
      type,
      pr,
      pg,
      pb,
      ramp.pivot,
      c,
    )
    const neg = makeDensityRgbStringFn(
      min,
      max,
      type,
      nr,
      ng,
      nb,
      ramp.pivot,
      c,
    )
    colorAt = score => (score < ramp.pivot ? neg(score) : pos(score))
  }
  const suffix =
    scaleType === 'log' ? ' (log)' : scaleType === 'symlog' ? ' (symlog)' : ''
  return {
    kind: 'ramp',
    id: 'score',
    title: `Score${suffix}`,
    domain,
    stops: Array.from({ length: STEPS + 1 }, (_, i) => {
      const offset = i / STEPS
      return { offset, color: colorAt(min + (max - min) * offset) }
    }),
    format: formatScore,
  }
}
