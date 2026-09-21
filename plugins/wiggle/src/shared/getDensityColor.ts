import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import {
  densityGradientT,
  densityRampT,
} from './shaders/wiggleCommon.js.generated.ts'

import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

// Density-color factory: maps a score to an "rgb(r,g,b)" string that fades
// from white at the pivot (default 0) toward the (r,g,b) color as
// |score - pivot| grows toward the bigger end of the domain. Caches 256 string
// buckets so the hot drawing loop avoids per-feature string allocation.
export function makeDensityRgbStringFn(
  domainMin: number,
  domainMax: number,
  scaleType: ScaleTypeCode,
  r: number,
  g: number,
  b: number,
  pivot = 0,
  symlogConstant = 1,
) {
  const normalize = makeScoreNormalizer(
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const zeroNorm = normalize(pivot)
  // The ramp position is wiggleCommon.slang's own `densityGradientT`, generated
  // into TS (adr-051). Both sides feed it already-normalized scores: the
  // normalizer is the other decision, and it is shared too (scoreScale.slang,
  // whose twin `makeScoreNormalizer` is swept against).
  const rDelta = r - 255
  const gDelta = g - 255
  const bDelta = b - 255
  const lut: (string | undefined)[] = new Array(256)
  return (score: number) => {
    const t = densityGradientT(normalize(score), zeroNorm)
    let idx = (t * 255) | 0
    if (idx < 0) {
      idx = 0
    } else if (idx > 255) {
      idx = 255
    }
    let s = lut[idx]
    if (s === undefined) {
      const tt = idx / 255
      s = `rgb(${(255 + rDelta * tt) | 0},${(255 + gDelta * tt) | 0},${(255 + bDelta * tt) | 0})`
      lut[idx] = s
    }
    return s
  }
}

/**
 * Where a named ramp's middle stop sits in the normalized domain: `rampMid`'s
 * position, clamped to [0, 1] by the normalizer as `buildColorRampLut` clamps
 * its `mid`, else 0.5, which runs the ramp straight from one end to the other.
 * The GPU's `rampMidNorm` uniform and the Canvas2D fill read this one number.
 */
export function rampMidNorm(
  domainMin: number,
  domainMax: number,
  scaleType: ScaleTypeCode,
  rampMid: number | undefined,
  symlogConstant = 1,
) {
  return rampMid === undefined
    ? 0.5
    : makeScoreNormalizer(
        domainMin,
        domainMax,
        scaleType,
        symlogConstant,
      )(rampMid)
}

// The named-ramp counterpart: the same normalizer the default fn and the
// shader share, then wiggleCommon.slang's `densityRampT` into the same
// 256-entry ramp bytes the GPU samples as the density pass's texture —
// `makeRampFillStyleLut` is the fillStyle LUT HiC's and LD's Canvas2D twins
// already index the same way. densityColorParity.test.ts sweeps the two
// backends onto one LUT bucket.
export function makeDensityLutFillFn(
  domainMin: number,
  domainMax: number,
  scaleType: ScaleTypeCode,
  ramp: Uint8Array,
  rampMid: number | undefined,
  symlogConstant = 1,
) {
  const normalize = makeScoreNormalizer(
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const midNorm = rampMidNorm(
    domainMin,
    domainMax,
    scaleType,
    rampMid,
    symlogConstant,
  )
  const fill = makeRampFillStyleLut(ramp)
  return (score: number) => fill(densityRampT(normalize(score), midNorm))
}
