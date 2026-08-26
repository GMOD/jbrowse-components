import {
  SCALE_TYPE_LOG as GENERATED_SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG as GENERATED_SCALE_TYPE_SYMLOG,
} from './wiggleRenderModes.generated.ts'

export type WiggleScaleType = 0 | 1 | 2
export const SCALE_TYPE_LINEAR: WiggleScaleType = 0
// The values the `scaleType` uniform is compared against, so they are
// wiggle.slang's own — generated in by `pnpm gen:shaders` (adr-051). LINEAR is
// simply "neither of these".
export const SCALE_TYPE_LOG: WiggleScaleType = GENERATED_SCALE_TYPE_LOG
export const SCALE_TYPE_SYMLOG: WiggleScaleType = GENERATED_SCALE_TYPE_SYMLOG

/**
 * #api
 * Maps the `'log'`/`'symlog'`/`'linear'` string to the numeric
 * `WiggleScaleType`.
 */
export function scaleTypeFromString(scaleType: string): WiggleScaleType {
  if (scaleType === 'log') {
    return SCALE_TYPE_LOG
  }
  if (scaleType === 'symlog') {
    return SCALE_TYPE_SYMLOG
  }
  return SCALE_TYPE_LINEAR
}

/**
 * #api
 * The symlog constant actually used for a domain. `0` (the config default)
 * means "pick one from the domain": a thousandth of its largest magnitude, so
 * the log-ish part of the curve covers the top three decades of whatever the
 * track holds and the linear knee sits below the data rather than through it.
 *
 * The alternative — d3's default of 1 — is `log(x + 1)`, which is fine for read
 * depth and useless for anything living below 1, because the entire domain then
 * falls in the linear part of the curve. A p-value track configured that way is
 * just a linear track wearing a log label, which is the reason this is resolved
 * rather than hard-coded.
 */
export function resolveSymlogConstant(
  min: number,
  max: number,
  configured: number,
): number {
  if (configured > 0) {
    return configured
  }
  const magnitude = Math.max(Math.abs(min), Math.abs(max))
  return magnitude > 0 ? magnitude / 1000 : 1
}

/** sign(x) * log1p(|x / c|) — the transform d3's scaleSymlog applies. */
function symlog(x: number, c: number) {
  return Math.sign(x) * Math.log1p(Math.abs(x / c))
}

/**
 * #api
 * Returns a loop-hoistable function normalizing a score to [0,1].
 *
 * `symlogConstant` is only read for `SCALE_TYPE_SYMLOG`, and is expected to be
 * already resolved by {@link resolveSymlogConstant} — the shader gets the same
 * resolved number as a uniform, so the "auto" rule lives on this side only and
 * the two backends compare like for like.
 *
 * A range that is zero **or negative** normalizes everything to 0, which is the
 * rule `scoreScale.slang` spells as `range <= 0.0`. Testing `range === 0` here
 * instead let a descending domain through to a negative `1 / range`, so every
 * score saturated to 1 on this side while the shader flattened them all to 0 —
 * one view, opposite plots. `normalizeScoreParity.test.ts` sweeps the two.
 */
export function makeScoreNormalizer(
  min: number,
  max: number,
  scaleType: WiggleScaleType,
  symlogConstant = 1,
) {
  if (scaleType === SCALE_TYPE_SYMLOG) {
    // No flooring, and no clamp of the domain away from zero: symlog is defined
    // across the whole real line, which is the point of offering it.
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
    // Floor at the domain's own min, not at 1. A log domain can sit entirely
    // below 1 — a mappability track, a methylation fraction, any normalized
    // ratio — and `getNiceDomain` deliberately keeps it there, pinning min to 1
    // only when max > 1 (an explicit `minScore` bound can also land under 1 at
    // any max). Flooring at 1 collapsed logMin and logMax to 0 for all of
    // those, so `logRange === 0` and every score in the track normalized to 0:
    // a plot flat on the baseline under an axis that, reading the same domain
    // through d3, spread its ticks down the full height.
    //
    // Callers passing min = 0 — the four coverage draws, whose domain starts at
    // no reads — still floor at 1, which is where a depth axis starts.
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
