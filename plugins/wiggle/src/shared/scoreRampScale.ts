import {
  denormalizeScore,
  scaleTypeCode,
} from '@jbrowse/render-core/scoreScale'
import { resolveSymlogConstant } from '@jbrowse/wiggle-core'

import { formatScore } from '../util.ts'
import { makeDensityLutFillFn } from './getDensityColor.ts'

import type { RampScale } from '@jbrowse/core/ui/colorScale'

// A gradient spends color on the score, so `[min, max]` alone says which
// numbers are in play but not which end is which color, nor where the middle
// stop sits between them. The key adds the missing half: a bar sampled from
// the actual color function, so the picture and the key cannot disagree.
export interface ScoreRamp {
  rampMid: number | undefined
  // the resolved rampLutOf LUT, the same cached bytes both renderers color
  // through
  rampLut: Uint8Array
}

const STEPS = 16

/**
 * The CSS color the gradient paints a score, through the LUT both renderers
 * index. `symlogConstant` is the raw slot, as `scoreRampScale` takes it.
 */
export function scoreRampFill(
  [min, max]: [number, number],
  scaleType: string,
  symlogConstant: number,
  ramp: ScoreRamp,
) {
  return makeDensityLutFillFn(
    min,
    max,
    scaleTypeCode(scaleType),
    ramp.rampLut,
    ramp.rampMid,
    resolveSymlogConstant(min, max, symlogConstant),
  )
}

/**
 * The gradient as a `RampScale`, sampled from the live color function rather
 * than its stops. `rampMidT` reads both sides of `rampMid` on one scale, so
 * with the middle off-center the nearer end stops short of its stop: a
 * heatmap over 0..6 with its white at 2 tops out at half saturation below it,
 * where a hand-written gradient would show both ends fully saturated and
 * overstate the short side. Each sample goes through the same score → t chain
 * into the same LUT bytes the renderers index.
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
  title: string,
): RampScale {
  const [min, max] = domain
  const type = scaleTypeCode(scaleType)
  const c = resolveSymlogConstant(min, max, symlogConstant)
  const colorAt = scoreRampFill(domain, scaleType, symlogConstant, ramp)
  const suffix =
    scaleType === 'log' ? ' (log)' : scaleType === 'symlog' ? ' (symlog)' : ''
  return {
    kind: 'ramp',
    id: 'score',
    title: `${title}${suffix}`,
    domain,
    stops: Array.from({ length: STEPS + 1 }, (_, i) => {
      const offset = i / STEPS
      return {
        offset,
        color: colorAt(denormalizeScore(offset, min, max, type, c)),
      }
    }),
    format: formatScore,
  }
}
