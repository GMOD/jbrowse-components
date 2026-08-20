import { hasCoverageScale } from '../../features/coverage/coverageScale.ts'

import type { RenderState } from './rendererTypes.ts'

// One coverage-band draw layer. The band's answer to `PileupLayerId`, and
// separate from it because these are position-aggregate marks packed in the
// WORKER rather than row-instanced ones packed at upload — a different feed, a
// different draw signature, and no share in the pileup band's z-order.
export type CoverageLayerId =
  | 'coverage'
  | 'snpCov'
  | 'modCov'
  | 'interbase'
  | 'indicator'

export interface CoverageLayer {
  id: CoverageLayerId
  enabled: (state: RenderState) => boolean
}

/**
 * Single source of truth for the coverage-band layer set, its z-order (back to
 * front) and its gating — the same job `PILEUP_LAYERS` does for the band below
 * it, and now for the same reason: both renderers iterate this list and map each
 * id through an exhaustive `Record<CoverageLayerId, …>`, so adding a layer is a
 * compile error in either backend until it is wired.
 *
 * **This list stood on the GPU renderer alone until 2026-08**, with the Canvas2D
 * band hand-listing the same five draws in the same order under a copy of the
 * same two gates. A unified manifest had been declined (REJECTED_IDEAS.md,
 * 2026-06) partly on this band: "coverage is individual passes vs one
 * `drawCoverage` wrapper". The wrapper turned out to hold five calls mapping 1:1
 * to the five passes, under gates that already agreed — so what the decline
 * described was two statements of one list, which is the thing a registry is
 * for. What it got right is the asymmetry below; erasing that would have cost
 * more than the duplication did.
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
export const COVERAGE_LAYERS: CoverageLayer[] = [
  { id: 'coverage', enabled: hasCoverageScale },
  { id: 'snpCov', enabled: hasCoverageScale },
  { id: 'modCov', enabled: hasCoverageScale },
  {
    id: 'interbase',
    enabled: s => hasCoverageScale(s) && s.showInterbaseIndicators,
  },
  { id: 'indicator', enabled: s => s.showInterbaseIndicators },
]
