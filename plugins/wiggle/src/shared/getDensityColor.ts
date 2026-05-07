import { cssColorToRgba } from '@jbrowse/core/util/colorBits'

import { makeScoreNormalizer } from '../util.ts'

// Low-level density-color factory: takes raw 0-255 rgb and an isLog boolean.
// Returns a closure that maps score → "rgb(r,g,b)" string, white→color as
// |score - 0| grows toward the bigger end of the domain. Caches strings in a
// 256-entry LUT to avoid per-feature allocation in the hot drawing loop.
export function makeDensityRgbStringFn(
  domainMin: number,
  domainMax: number,
  isLog: boolean,
  r: number,
  g: number,
  b: number,
) {
  const normalize = makeScoreNormalizer(domainMin, domainMax, isLog)
  const zeroNorm = normalize(0)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const invMaxDist = maxDist > 0.0001 ? 1 / maxDist : 0
  const rDelta = r - 255
  const gDelta = g - 255
  const bDelta = b - 255
  const lut: (string | undefined)[] = new Array(256)
  return (score: number) => {
    const t = Math.abs(normalize(score) - zeroNorm) * invMaxDist
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

export function makeDensityColorFn(
  minScore: number,
  maxScore: number,
  scaleType: string,
  colorHex: string,
) {
  const [r, g, b] = cssColorToRgba(colorHex)
  return makeDensityRgbStringFn(
    minScore,
    maxScore,
    scaleType === 'log',
    r,
    g,
    b,
  )
}

export function getDensityColor(
  score: number,
  minScore: number,
  maxScore: number,
  scaleType: string,
  colorHex: string,
) {
  return makeDensityColorFn(minScore, maxScore, scaleType, colorHex)(score)
}
