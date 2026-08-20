import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { WiggleScaleType } from '@jbrowse/wiggle-core'

/**
 * What the coverage band's depth scale is made of. The min and the max travel
 * together because a normalizer built from one of them is not a scale — three
 * separate draw sites each called `makeScoreNormalizer(0, domainMax, …)` with
 * their own hardcoded floor, which is how `minScore` came to be a setting that
 * changed nothing.
 *
 * Both are `undefined` until data lands, which is what gates the depth-scaled
 * passes on both backends. Not until the 500ms coarse debounce resolves — the
 * scan clips to `settledDynamicBlocks`, which answers over the live blocks while
 * the coarse ones are empty.
 */
export interface CoverageScaleState {
  coverageMinDepth: number | undefined
  coverageMaxDepth: number | undefined
  coverageScaleType: WiggleScaleType
  /**
   * symlog's linear-region width, already resolved from the domain. Unread by
   * the other two scales.
   */
  coverageSymlogConstant: number
}

export interface CoverageScale {
  /**
   * Depth → [0,1] height fraction, for every mark that is a reading of the
   * coverage axis: the depth bars, the SNP segments stacked inside them, and the
   * modification segments. The GPU twin is `normalizeDepth` in
   * alignmentsUniforms.slang, pinned to this by `coverageNormalizeParity.test`.
   */
  normalize: (depth: number) => number
  /**
   * The raw domain max, for the marks that are NOT readings of that axis. The
   * interbase (clip/insertion) bars are the only ones: their height is
   * `count / regionMaxDepth` against a half-band reference — a ratio of event
   * counts — so the domain min has nothing to say about them, and they need the
   * max on its own.
   */
  domainMax: number
}

/**
 * The coverage band's resolved depth scale, or `undefined` while autoscale is
 * still settling — which is also the single gate the depth-scaled layers are
 * drawn under, on both backends.
 *
 * Returning the gate and the scale as one value is the point: as a bare
 * `domainMax !== undefined` check beside three independent `makeScoreNormalizer`
 * calls, a layer could be drawn against a domain no other layer was using, and
 * three of them were.
 */
export function makeCoverageScale(
  state: CoverageScaleState,
): CoverageScale | undefined {
  if (!hasCoverageScale(state)) {
    return undefined
  }
  const {
    coverageMinDepth,
    coverageMaxDepth,
    coverageScaleType,
    coverageSymlogConstant,
  } = state
  return {
    normalize: makeScoreNormalizer(
      coverageMinDepth ?? 0,
      coverageMaxDepth,
      coverageScaleType,
      coverageSymlogConstant,
    ),
    domainMax: coverageMaxDepth,
  }
}

/**
 * Whether the depth domain has resolved. The GPU builds no normalizer — its
 * passes read the uniforms directly — so it can't gate on `makeCoverageScale`
 * itself, but it must gate on the same question: this is the one predicate both
 * backends skip the depth-scaled layers under, rather than a
 * `coverageMaxDepth !== undefined` written once per backend.
 *
 * It narrows, so `makeCoverageScale` doesn't have to write that literal a third
 * time to convince TypeScript the max is resolved — which is what it did, two
 * lines above the sentence forbidding it.
 */
export function hasCoverageScale<
  T extends Pick<CoverageScaleState, 'coverageMaxDepth'>,
>(state: T): state is T & { coverageMaxDepth: number } {
  return state.coverageMaxDepth !== undefined
}
