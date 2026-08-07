import { SCALE_TYPE_LOG as GENERATED_SCALE_TYPE_LOG } from './wiggleRenderModes.generated.ts'

export type WiggleScaleType = 0 | 1
export const SCALE_TYPE_LINEAR: WiggleScaleType = 0
// The value the `scaleType` uniform is compared against, so it is wiggle.slang's
// own — generated in by `pnpm gen:shaders` (adr-051). Only LOG crosses the
// boundary; LINEAR is simply "not that".
export const SCALE_TYPE_LOG: WiggleScaleType = GENERATED_SCALE_TYPE_LOG

/**
 * #api
 * Maps the `'log'`/`'linear'` string to the numeric `WiggleScaleType`.
 */
export function scaleTypeFromString(scaleType: string): WiggleScaleType {
  return scaleType === 'log' ? SCALE_TYPE_LOG : SCALE_TYPE_LINEAR
}

/**
 * #api
 * Returns a loop-hoistable function normalizing a score to [0,1].
 */
export function makeScoreNormalizer(min: number, max: number, isLog: boolean) {
  if (isLog) {
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
    if (logRange === 0) {
      return () => 0
    }
    const invLogRange = 1 / logRange
    return (score: number) => {
      const logScore = Math.log2(Math.max(score, floor))
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
