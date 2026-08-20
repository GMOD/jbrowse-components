import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import {
  covBottomOffsetPx,
  covEffectiveHeightPx,
} from './coverageBandLayout.generated.ts'

// Where the coverage bars live inside the band: the drawable height, and how
// far the baseline sits below the band's top edge. Every coverage mark on both
// backends measures from these two, and they are the shader's own — generated
// from alignmentsUniforms via coverage.slang (adr-051). The label inset is
// reserved at both ends, which is the whole reason the two differ.
//
// Its own module rather than a member of `rendererUtils.ts`, because the axis
// needs it too and `rendererUtils.ts` is downstream of `coverageDownsampling.ts`
// (where `computeCoverageTicks` lives). It is the coverage band's `axisPlotBox`:
// the drawing places its marks with it and the ticks place themselves with it,
// which is the only way a tick can be trusted to land on its own data.
export function coverageLayout(coverageHeight: number) {
  return {
    effectiveH: covEffectiveHeightPx(coverageHeight, YSCALEBAR_LABEL_OFFSET),
    bottom: covBottomOffsetPx(coverageHeight, YSCALEBAR_LABEL_OFFSET),
  }
}

/**
 * Full-scale height in px of the interbase histogram — what a bar whose stacked
 * fractions sum to 1 occupies, hanging from just below the indicator triangles.
 * 0 means "draw nothing": no interbase events, or the autoscaled domain has not
 * resolved yet, which now means only that no data has landed —
 * `settledDynamicBlocks` covers the window where the coarse blocks are empty and
 * `settleCoarseBlocks` the one where they describe somewhere else.
 *
 * Inverted clip/insertion bars scale to HALF the coverage drawing height
 * (origin/main's `range: [0, height/2]`), so they grow with the track rather
 * than being clipped at a fixed pixel cap. The worker bakes each segment as a
 * fraction of the region's raw peak depth (`interbaseMaxCount`); dividing it
 * back out and multiplying by the display's autoscaled domain is what makes a
 * bar of N events the same height in every region of the view, against the same
 * DOMAIN the coverage bars use — otherwise they render too short when the
 * fetched peak exceeds the nice rounded visible domain (SV breakpoints), or too
 * tall when a caller passes the region's own peak as the domain.
 *
 * The domain, and not the axis: this is a ratio of event counts against a
 * half-band reference, so it is linear even when the coverage bars are
 * log-scaled, and the domain MIN has nothing to say about it. `CoverageScale`
 * in `features/coverage/coverageScale.ts` is where that distinction is stated
 * for the callers — it hands the interbase bars `domainMax` rather than the
 * normalizer, on purpose. This comment used to say "on the same axis the
 * coverage bars use", which reads as a bug report against the log case.
 *
 * Shared because there are three readings of it and they had drifted into two
 * formulas: the Canvas2D draw, the hit test that must match the drawn rectangle,
 * and the `interbaseHeight` uniform `interbaseHistogram.slang` hangs its bars
 * from. The uniform used to spell the ratio `region.maxDepth / domainMax`, which
 * agrees with `interbaseMaxCount / domainMax` only while the region has any read
 * depth at all — at depth 0 the worker's `Math.max(maxDepth, 1)` floor means the
 * two disagree by the whole bar.
 */
export function interbaseBarHeightPx(
  coverageHeight: number,
  interbaseMaxCount: number,
  domainMax: number | undefined,
) {
  return interbaseMaxCount > 0 && domainMax !== undefined && domainMax > 0
    ? (coverageLayout(coverageHeight).effectiveH / 2) *
        (interbaseMaxCount / domainMax)
    : 0
}
