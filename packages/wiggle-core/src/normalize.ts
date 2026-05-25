export type WiggleScaleType = 0 | 1
export const SCALE_TYPE_LINEAR: WiggleScaleType = 0
export const SCALE_TYPE_LOG: WiggleScaleType = 1

export function scaleTypeFromString(scaleType: string): WiggleScaleType {
  return scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR
}

// Returns a function that normalizes a score to [0,1] given a fixed domain.
// Hoisting this outside of feature loops avoids recomputing log(min)/log(max)
// per feature when isLog is true.
export function makeScoreNormalizer(min: number, max: number, isLog: boolean) {
  if (isLog) {
    const logMin = Math.log2(Math.max(min, 1))
    const logMax = Math.log2(Math.max(max, 1))
    const logRange = logMax - logMin
    if (logRange === 0) {
      return () => 0
    }
    const invLogRange = 1 / logRange
    return (score: number) => {
      const logScore = Math.log2(Math.max(score, 1))
      return Math.max(0, Math.min(1, (logScore - logMin) * invLogRange))
    }
  }
  const range = max - min
  if (range === 0) {
    return () => 0
  }
  const invRange = 1 / range
  return (score: number) => Math.max(0, Math.min(1, (score - min) * invRange))
}
