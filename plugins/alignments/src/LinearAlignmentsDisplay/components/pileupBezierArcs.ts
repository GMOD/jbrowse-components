import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { sectionBandBottom } from './sectionScreen.ts'
import { computePileupBezierArcs } from '../../features/linkedReads/computeOverlay.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Single source of truth mapping model + view state to bezier-arc geometry, so
// the on-screen overlay (PileupBezierOverlay) and the SVG export (renderSvg)
// cannot drift in which fields feed the curves. Only `scrollTop` legitimately
// differs — on-screen scrolls, export shows the full height — so it stays a
// parameter. Returns [] unless the bezier connection overlay is enabled.
//
// Loops `model.renderSections` so every group's pairs get arcs, not just the
// first; each section supplies its own `topOffset` (pileup band top) and
// `viewportH` (band height, via the shared `sectionBandBottom`), mirroring how
// `computeVisibleLabels`/`computeHighlightBoxes` clip per section.
export function computePileupBezierArcsFromModel(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
  scrollTop: number,
): PileupArc[] {
  if (!model.showBezierConnections) {
    return []
  }
  const bpToScreenX = makeBpToScreenX(view)
  const scroll = {
    isGrouped: model.isGrouped,
    scrollTop,
    canvasHeight: model.height,
  }
  const result: PileupArc[] = []
  for (const sec of model.renderSections) {
    const bottom = sectionBandBottom(sec.topOffset, sec.pileupHeight, scroll)
    result.push(
      ...computePileupBezierArcs({
        laidOutPileupMap: sec.laidOutPileupMap,
        displayedRegions: view.displayedRegions,
        bpToScreenX,
        featureHeight: model.featureHeight,
        featureSpacing: model.featureSpacing,
        pileupTopOffset: sec.topOffset,
        scrollTop,
        viewportH: bottom - sec.topOffset,
      }),
    )
  }
  return result
}
