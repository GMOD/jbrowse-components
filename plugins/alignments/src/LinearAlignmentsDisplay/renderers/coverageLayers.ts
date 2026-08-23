import { COVERAGE_BAND_LAYER_ORDER } from '@jbrowse/render-core/coverageBand'

import { hasCoverageScale } from '../../features/coverage/coverageScale.ts'

import type { RenderState } from './rendererTypes.ts'
import type { CoverageLayerId } from '@jbrowse/render-core/coverageBand'

export interface CoverageLayer {
  id: CoverageLayerId
  enabled: (state: RenderState) => boolean
}

/**
 * This display's gate on each coverage-band layer. The z-order is NOT here — it
 * is `COVERAGE_BAND_LAYER_ORDER` in render-core, because the MAF display draws
 * the same band and the order is one fact. What is per-display is exactly this
 * table: MAF has no `showInterbaseIndicators` setting and no modification calls.
 *
 * The band as a whole is gated by `showCoverage` at the call site.
 *
 * `enabled` is the DRAW's, never the upload's: gating an upload on a
 * repaint-tier setting would make a mid-session toggle paint nothing until the
 * next fetch replaced the buffer it never wrote.
 *
 * Two axes, and only one of them is uniform across the list:
 *
 * - **The depth domain.** Four layers scale to it and are skipped until it
 *   resolves, so they gate on `hasCoverageScale` — the predicate
 *   `makeCoverageScale` answers by returning `undefined`. `indicator` does not:
 *   its triangles are fixed-size, and gating them on data would blank them for
 *   the whole fetch.
 * - **The interbase toggle.** `showInterbaseIndicators` governs ALL interbase
 *   marks — the count bars and the triangles alike, which is why the one setting
 *   appears twice.
 */
const COVERAGE_LAYER_ENABLED: Record<
  CoverageLayerId,
  (state: RenderState) => boolean
> = {
  coverage: hasCoverageScale,
  snpCov: hasCoverageScale,
  modCov: hasCoverageScale,
  interbase: s => hasCoverageScale(s) && s.showInterbaseIndicators,
  indicator: s => s.showInterbaseIndicators,
}

/**
 * The coverage-band layer set for this display, in the shared paint order — the
 * same job `PILEUP_LAYERS` does for the band below it, and now for the same
 * reason: both renderers iterate this list and map each id through an exhaustive
 * `Record<CoverageLayerId, …>`, so adding a layer is a compile error in either
 * backend until it is wired.
 *
 * **This list stood on the GPU renderer alone until 2026-08**, with the Canvas2D
 * band hand-listing the same five draws in the same order under a copy of the
 * same two gates. A unified manifest had been declined (REJECTED_IDEAS.md,
 * 2026-06) partly on this band: "coverage is individual passes vs one
 * `drawCoverage` wrapper". The wrapper turned out to hold five calls mapping 1:1
 * to the five passes, under gates that already agreed — so what the decline
 * described was two statements of one list, which is the thing a registry is
 * for. What it got right is the asymmetry above; erasing that would have cost
 * more than the duplication did.
 */
export const COVERAGE_LAYERS: CoverageLayer[] = COVERAGE_BAND_LAYER_ORDER.map(
  id => ({ id, enabled: COVERAGE_LAYER_ENABLED[id] }),
)
