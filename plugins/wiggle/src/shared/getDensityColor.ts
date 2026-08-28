import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { densityGradientT } from './shaders/wiggleCommon.js.generated.ts'

import type { WiggleScaleType } from '@jbrowse/wiggle-core'

// Density-color factory: maps a score to an "rgb(r,g,b)" string that fades
// from white at the pivot (`origin`, default 0) toward the (r,g,b) color as
// |score - origin| grows toward the bigger end of the domain. Caches 256 string
// buckets so the hot drawing loop avoids per-feature string allocation.
export function makeDensityRgbStringFn(
  domainMin: number,
  domainMax: number,
  scaleType: WiggleScaleType,
  r: number,
  g: number,
  b: number,
  origin = 0,
  symlogConstant = 1,
) {
  const normalize = makeScoreNormalizer(
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const zeroNorm = normalize(origin)
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

// The named-ramp counterpart, for a density track whose `densityColorRamp`
// names a LUT (viridis etc.): the same score → t chain the default fn and the
// shader share (normalizeScore then densityGradientT), indexed into the same
// 256-entry ramp bytes the GPU samples as the density pass's texture —
// `makeRampFillStyleLut` is the fillStyle LUT HiC's and LD's Canvas2D twins
// already index the same way. densityColorParity.test.ts sweeps the two
// backends onto one LUT bucket.
export function makeDensityLutFillFn(
  domainMin: number,
  domainMax: number,
  scaleType: WiggleScaleType,
  ramp: Uint8Array,
  origin = 0,
  symlogConstant = 1,
) {
  const normalize = makeScoreNormalizer(
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
  )
  const zeroNorm = normalize(origin)
  const fill = makeRampFillStyleLut(ramp)
  return (score: number) => fill(densityGradientT(normalize(score), zeroNorm))
}
