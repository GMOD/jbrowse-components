import {
  SCALE_TYPE_LOG as GENERATED_SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG as GENERATED_SCALE_TYPE_SYMLOG,
} from './shaders/scoreScale.generated.ts'

/** `scoreScale.slang`'s scale-type vocabulary, where 0 is linear. */
export type ScaleTypeCode =
  | 0
  | typeof GENERATED_SCALE_TYPE_LOG
  | typeof GENERATED_SCALE_TYPE_SYMLOG

export const SCALE_TYPE_LINEAR: ScaleTypeCode = 0
export const SCALE_TYPE_LOG: ScaleTypeCode = GENERATED_SCALE_TYPE_LOG
export const SCALE_TYPE_SYMLOG: ScaleTypeCode = GENERATED_SCALE_TYPE_SYMLOG

/** The code the `scaleType` uniform compares for a `'log'`/`'symlog'` name. */
export function scaleTypeCode(scaleType: string | undefined): ScaleTypeCode {
  return scaleType === 'log'
    ? SCALE_TYPE_LOG
    : scaleType === 'symlog'
      ? SCALE_TYPE_SYMLOG
      : 0
}

// `Math.log1p` rather than a bare `log(1 + x)`, which loses precision
// near zero; `scoreScale.slang` spells the same correction by hand.
function symlog(x: number, c: number) {
  return Math.sign(x) * Math.log1p(Math.abs(x / c))
}

/**
 * `normalizeScore` with the per-domain arithmetic hoisted out of a per-feature
 * loop: the clamped `[0, 1]` fraction a score sits at, and on a domain with no
 * range 1 above its min and 0 elsewhere. `symlogConstant` is the resolved one
 * the shader gets as a uniform.
 */
export function makeScoreNormalizer(
  min: number,
  max: number,
  scaleType: ScaleTypeCode,
  symlogConstant: number,
): (score: number) => number {
  if (scaleType === SCALE_TYPE_SYMLOG) {
    const c = symlogConstant
    const tMin = symlog(min, c)
    const tMax = symlog(max, c)
    const tRange = tMax - tMin
    if (tRange <= 0) {
      return (score: number) => (symlog(score, c) > tMin ? 1 : 0)
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
      return (score: number) =>
        Math.log2(Math.max(score, floor)) > logMin ? 1 : 0
    }
    const invLogRange = 1 / logRange
    return (score: number) => {
      const logScore = Math.log2(Math.max(score, floor))
      return Math.max(0, Math.min(1, (logScore - logMin) * invLogRange))
    }
  }
  const range = max - min
  if (range <= 0) {
    return (score: number) => (score > min ? 1 : 0)
  }
  const invRange = 1 / range
  return (score: number) => Math.max(0, Math.min(1, (score - min) * invRange))
}

function symlogInverse(y: number, c: number) {
  return Math.sign(y) * c * Math.expm1(Math.abs(y))
}

function atFraction(t: number, tMin: number, tMax: number) {
  return tMax > tMin ? tMin + t * (tMax - tMin) : tMin
}

/**
 * `normalizeScore`'s unclamped inverse, the score at fraction `t`. A domain
 * with no range answers its min, floored for log, where the forward step sits.
 */
export function denormalizeScore(
  t: number,
  min: number,
  max: number,
  scaleType: ScaleTypeCode,
  symlogConstant: number,
) {
  if (scaleType === SCALE_TYPE_SYMLOG) {
    const c = symlogConstant
    return symlogInverse(atFraction(t, symlog(min, c), symlog(max, c)), c)
  }
  if (scaleType === SCALE_TYPE_LOG) {
    const floor = min > 0 ? min : 1
    return 2 ** atFraction(t, Math.log2(floor), Math.log2(Math.max(max, floor)))
  }
  return atFraction(t, min, max)
}
