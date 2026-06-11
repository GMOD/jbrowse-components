import { makeBpToScreenX } from './alignmentComponentUtils.ts'
import { computeSashimiArcs } from '../../features/sashimi/computeOverlay.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { SashimiArc } from '../../features/sashimi/computeOverlay.ts'
import type { LinearAlignmentsDisplayModel } from '../model.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Shared by the on-screen overlay and the SVG export so geometry, score filter,
// and paint order can't drift. The data map is the one legitimate difference:
// the overlay passes `rpcDataMap` (sashimi ignores Y-layout, so no recompute on
// relayout), the export passes the settled `laidOutPileupMap`.
export function computeSashimiArcsFromModel(
  model: LinearAlignmentsDisplayModel,
  view: LinearGenomeViewModel,
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
): SashimiArc[] {
  if (!model.showSashimiArcs || !model.showCoverage) {
    return []
  }
  const arcs = computeSashimiArcs({
    rpcDataMap,
    visibleRegions: view.visibleRegions,
    bpToScreenX: makeBpToScreenX(view),
    coverageHeight: model.coverageHeight,
    sashimiArcsHeight: model.sashimiArcsHeight,
    sashimiArcsDown: model.readConnectionsDown,
    minSashimiScore: model.minSashimiScore,
  })
  // Sort by score so high-count arcs paint on top of low-count ones.
  arcs.sort((a, b) => a.score - b.score)
  return arcs
}

// Stable React key / selection identity, shared by overlay and export.
export function sashimiArcKey(arc: SashimiArc) {
  return `${arc.refName}:${arc.start}:${arc.end}:${arc.strand}`
}
