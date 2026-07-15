import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { sectionBandBottom } from './sectionScreen.ts'
import { computePileupBezierArcs } from '../../features/linkedReads/computeOverlay.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Stroke style shared by the on-screen overlay (PileupBezierOverlay) and the SVG
// export (PileupBezierArcsSvg) so the two paths can't drift, per the invariant
// in this dir's CLAUDE.md. Selection thickens the on-screen stroke only (not
// exported), so that width lives at the overlay call site.
export const BEZIER_ARC_STROKE_WIDTH = 1
export const BEZIER_ARC_STROKE_OPACITY = 0.8

// Single source of truth mapping model + view state to bezier-arc geometry, so
// the on-screen overlay (PileupBezierOverlay) and the SVG export (renderSvg)
// cannot drift in which fields feed the curves. Only `scrollTop` legitimately
// differs — on-screen scrolls, export shows the full height — so it stays a
// parameter. Returns [] unless the bezier connection overlay is enabled.
//
// Loops `model.renderSections` so every group's pairs get arcs, not just the
// first; each section supplies its own `topOffset` (pileup band top) and
// `viewportBottom` (band bottom, via the shared `sectionBandBottom`), mirroring
// how `computeVisibleLabels`/`computeHighlightBoxes` clip per section.
export function computePileupBezierArcsFromModel(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
  scrollTop: number,
): PileupArc[] {
  // `bezierPairSections` is [] when the overlay is off and memoizes the
  // scroll-invariant pair enumeration, so a scroll frame only re-runs the
  // screen projection below.
  const bpToScreenX = makeBpToScreenX(view)
  const scroll = {
    isGrouped: model.isGrouped,
    scrollTop,
    canvasHeight: model.height,
  }
  const result: PileupArc[] = []
  for (const sec of model.bezierPairSections) {
    const bottom = sectionBandBottom(sec.topOffset, sec.pileupHeight, scroll)
    result.push(
      ...computePileupBezierArcs({
        pairs: sec.pairs,
        displayedRegions: view.displayedRegions,
        bpToScreenX,
        featureHeight: model.featureHeight,
        featureSpacing: model.featureSpacing,
        pileupTopOffset: sec.topOffset,
        scrollTop,
        viewportBottom: bottom,
      }),
    )
  }
  return result
}
