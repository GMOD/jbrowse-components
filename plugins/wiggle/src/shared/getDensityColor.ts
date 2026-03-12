function parseHexColor(hex: string) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b] as const
}

function normalizeScore(
  score: number,
  min: number,
  max: number,
  scaleType: string,
) {
  if (scaleType === 'log') {
    const logMin = Math.log2(Math.max(min, 1))
    const logMax = Math.log2(Math.max(max, 1))
    const logScore = Math.log2(Math.max(score, 1))
    return (logScore - logMin) / (logMax - logMin)
  }
  return (score - min) / (max - min)
}

export function getDensityColor(
  score: number,
  minScore: number,
  maxScore: number,
  scaleType: string,
  colorHex: string,
) {
  const norm = normalizeScore(score, minScore, maxScore, scaleType)
  const zeroNorm = normalizeScore(0, minScore, maxScore, scaleType)
  const maxDist = Math.max(zeroNorm, 1 - zeroNorm)
  const t = Math.min(
    1,
    Math.max(0, Math.abs(norm - zeroNorm) / Math.max(maxDist, 0.0001)),
  )

  const [r, g, b] = parseHexColor(colorHex)
  const mr = Math.round(255 + (r - 255) * t)
  const mg = Math.round(255 + (g - 255) * t)
  const mb = Math.round(255 + (b - 255) * t)
  return `rgb(${mr},${mg},${mb})`
}
