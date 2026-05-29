import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { computePileupBezierArcs } from '../../features/linkedReads/computeOverlay.ts'

import type { PileupArc } from '../../features/linkedReads/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Single source of truth mapping model + view state to bezier-arc geometry, so
// the on-screen overlay (PileupArcsOverlay) and the SVG export (renderSvg)
// cannot drift in which fields feed the curves. Only `rangeY` legitimately
// differs — on-screen scrolls, export shows the full height — so it stays a
// parameter. Returns [] unless linked-reads bezier mode is active.
export function computePileupBezierArcsFromModel(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
  rangeY: [number, number],
): PileupArc[] {
  return model.linkedReads === 'bezier'
    ? computePileupBezierArcs({
        laidOutPileupMap: model.laidOutPileupMap,
        displayedRegions: view.displayedRegions,
        bpToScreenX: makeBpToScreenX(view),
        featureHeight: model.featureHeightSetting,
        featureSpacing: model.featureSpacing,
        pileupTopOffset: model.coverageDisplayHeight,
        rangeY,
        viewportH: model.pileupViewportHeight,
        pairedArcsDown: model.pairedConnectionsDown,
      })
    : []
}
