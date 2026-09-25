import { computePileupBezierArcs } from '../../features/linkedReads/computeOverlay.ts'
import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { bandScreenTop, sectionBandBottom } from './sectionScreen.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Stroke style shared by the on-screen overlay (PileupBezierOverlay) and the SVG
// export (PileupBezierArcsSvg) so the two paths can't drift, per the invariant
// in this dir's CLAUDE.md. Selection thickens the on-screen stroke only (not
// exported), so that width lives at the overlay call site.
export const BEZIER_ARC_STROKE_WIDTH = 1
export const BEZIER_ARC_STROKE_OPACITY = 0.8

export interface BezierArcSection {
  groupKey: string
  // Screen-y of the section's pileup band. Its reads scroll under the bands
  // above it, and so do their connectors.
  clipTop: number
  clipBottom: number
  arcs: PileupArc[]
}

// The bezier-arc geometry of every section, shared by the on-screen overlay and
// the SVG export so the two cannot drift in which fields feed the curves.
// Empty unless the bezier connection overlay is enabled.
export function computePileupBezierArcsFromModel(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
  colors = model.colorPalette,
): BezierArcSection[] {
  const bpToScreenX = makeBpToScreenX(view)
  const scroll = model.scrollModel
  const result: BezierArcSection[] = []
  for (const sec of model.bezierPairSections) {
    const clipTop = bandScreenTop(sec.topOffset, scroll)
    const clipBottom = sectionBandBottom(
      sec.topOffset,
      sec.pileupHeight,
      scroll,
    )
    const arcs = computePileupBezierArcs({
      pairs: sec.pairs,
      colors,
      displayedRegions: view.displayedRegions,
      bpToScreenX,
      featureHeight: model.featureHeight,
      featureSpacing: model.featureSpacing,
      pileupTopOffset: sec.topOffset,
      scrollTop: scroll.scrollTop,
      viewportTop: clipTop,
      viewportBottom: clipBottom,
    })
    if (arcs.length > 0) {
      result.push({ groupKey: sec.groupKey, clipTop, clipBottom, arcs })
    }
  }
  return result
}
