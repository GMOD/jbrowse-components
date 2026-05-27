import { makeScoreNormalizer } from '../util.ts'

// Density-color factory: maps a score to an "rgb(r,g,b)" string that fades
// from white at score=0 toward the (r,g,b) color as |score| grows toward the
// bigger end of the domain. Caches 256 string buckets so the hot drawing loop
// avoids per-feature string allocation.
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
