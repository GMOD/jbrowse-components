import {
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from './shaders/scoreScale.generated.ts'

/** `scoreScale.slang`'s scale-type vocabulary, where 0 is linear. */
export type ScaleTypeCode = 0 | typeof SCALE_TYPE_LOG | typeof SCALE_TYPE_SYMLOG

/** The code the `scaleType` uniform compares for a `'log'`/`'symlog'` name. */
export function scaleTypeCode(scaleType: string | undefined): ScaleTypeCode {
  return scaleType === 'log'
    ? SCALE_TYPE_LOG
    : scaleType === 'symlog'
      ? SCALE_TYPE_SYMLOG
      : 0
}

// `Math.log1p` rather than the shader's `log(1.0 + x)`, which loses precision
// near zero.
function symlog(x: number, c: number) {
  return Math.sign(x) * Math.log1p(Math.abs(x / c))
}

/**
 * `normalizeScore` with the per-domain arithmetic hoisted out of a per-feature
 * loop: the `[0, 1]` fraction a score sits at in the domain, clamped. The
 * generated `normalizeScore` is the oracle `normalizeScoreParity.test.ts`
 * sweeps it against.
 *
 * `symlogConstant` is read only for `SCALE_TYPE_SYMLOG`, already resolved by
 * `resolveSymlogConstant`, which is the number the shader gets as a uniform.
 */
export function makeScoreNormalizer(
  min: number,
  max: number,
  scaleType: ScaleTypeCode,
  symlogConstant = 1,
): (score: number) => number {
  if (scaleType === SCALE_TYPE_SYMLOG) {
    const c = symlogConstant
    const tMin = symlog(min, c)
    const tMax = symlog(max, c)
    const tRange = tMax - tMin
    if (tRange <= 0) {
      return () => 0
    }
    const invRange = 1 / tRange
    return (score: number) =>
      Math.max(0, Math.min(1, (symlog(score, c) - tMin) * invRange))
  }
  if (scaleType === SCALE_TYPE_LOG) {
    const floor = min > 0 ? min : 1
    const logMin = Math.log2(floor)
    const logMax = Math.log2(Math.max(max, floor))
    const logRange = logMax - logMin
    if (logRange <= 0) {
      return () => 0
    }
    const invLogRange = 1 / logRange
    return (score: number) => {
      const logScore = Math.log2(Math.max(score, floor))
      return Math.max(0, Math.min(1, (logScore - logMin) * invLogRange))
    }
  }
  const range = max - min
  if (range <= 0) {
    return () => 0
  }
  const invRange = 1 / range
  return (score: number) => Math.max(0, Math.min(1, (score - min) * invRange))
}
