import { collectArcs, resolveArcsByGroup } from './compute.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcRegions, ArcSettings } from './arcTypes.ts'

export function computeArcsByGroup(
  rawDataByGroup: ReadonlyMap<string, Map<number, WorkerPileupData>>,
  regions: ArcRegions,
  settings: ArcSettings,
) {
  return resolveArcsByGroup(
    collectArcs(rawDataByGroup, regions.loaded, settings),
    regions,
    settings,
  )
}
