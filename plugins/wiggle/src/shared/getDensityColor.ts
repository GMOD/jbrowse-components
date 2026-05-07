import { cssColorToRgba } from '@jbrowse/core/util/colorBits'

import { makeScoreNormalizer } from '../util.ts'

export function makeDensityColorFn(
  minScore: number,
  maxScore: number,
  scaleType: string,
  colorHex: string,
) {
  const normalize = makeScoreNormalizer(minScore, maxScore, scaleType === 'log')
  const zeroNorm = normalize(0)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const invMaxDist = maxDist > 0.0001 ? 1 / maxDist : 0
  const [r, g, b] = cssColorToRgba(colorHex)
  const rDelta = r - 255
  const gDelta = g - 255
  const bDelta = b - 255
  return (score: number) => {
    const t = Math.abs(normalize(score) - zeroNorm) * invMaxDist
    return `rgb(${Math.round(255 + rDelta * t)},${Math.round(255 + gDelta * t)},${Math.round(255 + bDelta * t)})`
  }
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
