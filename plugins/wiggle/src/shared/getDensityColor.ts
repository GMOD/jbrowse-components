import { cssColorToRgba } from '@jbrowse/core/util/colorBits'

import { normalizeScore } from '../util.ts'

export function getDensityColor(
  score: number,
  minScore: number,
  maxScore: number,
  scaleType: string,
  colorHex: string,
) {
  const isLog = scaleType === 'log'
  const norm = normalizeScore(score, minScore, maxScore, isLog)
  const zeroNorm = normalizeScore(0, minScore, maxScore, isLog)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const t = Math.min(
    1,
    Math.max(0, Math.abs(norm - zeroNorm) / Math.max(maxDist, 0.0001)),
  )

  const [r, g, b] = cssColorToRgba(colorHex)
  const mr = Math.round(255 + (r - 255) * t)
  const mg = Math.round(255 + (g - 255) * t)
  const mb = Math.round(255 + (b - 255) * t)
  return `rgb(${mr},${mg},${mb})`
}
