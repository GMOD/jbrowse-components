import { cssColorToRgba } from '@jbrowse/core/util/colorBits'

import { makeScoreNormalizer } from '../util.ts'

export function getDensityColor(
  score: number,
  minScore: number,
  maxScore: number,
  scaleType: string,
  colorHex: string,
) {
  const normalize = makeScoreNormalizer(minScore, maxScore, scaleType === 'log')
  const norm = normalize(score)
  const zeroNorm = normalize(0)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const t = Math.abs(norm - zeroNorm) / Math.max(maxDist, 0.0001)

  const [r, g, b] = cssColorToRgba(colorHex)
  return `rgb(${Math.round(255 + (r - 255) * t)},${Math.round(255 + (g - 255) * t)},${Math.round(255 + (b - 255) * t)})`
}
