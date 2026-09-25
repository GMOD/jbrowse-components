import { computePileupBezierArcs } from '../../features/linkedReads/computeOverlay.ts'
import { LINKED_READ_LINE_ALPHA } from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { bandScreenTop, sectionBandBottom } from './sectionScreen.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The straight-line pass's alpha, so a connector reads the same whichever pass
// draws it. Each arc carries its own width.
export const BEZIER_ARC_STROKE_OPACITY = LINKED_READ_LINE_ALPHA

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
      pileupHeight: sec.pileupHeight,
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
