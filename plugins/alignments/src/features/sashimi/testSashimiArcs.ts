import { projectSashimiArcs, visibleRegionJunctions } from './computeOverlay.ts'
import { mergeJunctions } from './junctions.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ProjectSashimiArcsOpts } from './computeOverlay.ts'
import type { JunctionFilter } from './junctions.ts'

export interface ComputeSashimiArcsOpts
  extends ProjectSashimiArcsOpts, JunctionFilter {
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
}

// The merge and the projection composed, both sides in one list tagged with
// the side each landed on, ascending by score.
export function computeSashimiArcs(opts: ComputeSashimiArcsOpts) {
  const { up, down } = projectSashimiArcs(
    mergeJunctions(
      visibleRegionJunctions(opts.rpcDataMap, opts.visibleRegions),
      opts,
    ).values(),
    opts,
  )
  return [
    ...up.map(arc => ({ ...arc, side: 'up' as const })),
    ...down.map(arc => ({ ...arc, side: 'down' as const })),
  ].sort((a, b) => a.score - b.score)
}
