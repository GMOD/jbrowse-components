import { doesIntersect2 } from '@jbrowse/core/util'

import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/canLaunchSyntenyForMate.ts'

import type { MateDiscoveryResult } from '../LaunchSyntenyView/pickMatesForRegion.ts'
import type { ResolvedPanel } from '../LaunchSyntenyView/resolvePanel.ts'
import type { LaneDecision } from './laneDecision.ts'
import type { MultiWayGroup } from './layoutMultiWay.ts'

// what a lane's decision says about where it is: its contig, the extent the
// settle fitted to its placements, and whether it runs against the anchor
export type LanePlacementDecision = Pick<
  LaneDecision,
  'refName' | 'fitMin' | 'fitMax' | 'flipped'
>

// the part of one placement's mate interval that `region` maps into, in
// proportion along the placement the way its ribbon is drawn
function mateSliceOf(
  anchor: { start: number; end: number },
  placement: { start: number; end: number; orientation: number },
  region: { start: number; end: number },
) {
  const lo = Math.max(anchor.start, region.start)
  const hi = Math.min(anchor.end, region.end)
  const scale =
    (placement.end - placement.start) / Math.max(anchor.end - anchor.start, 1)
  const from = (lo - anchor.start) * scale
  const to = (hi - anchor.start) * scale
  return {
    anchorStart: lo,
    anchorEnd: hi,
    ...(placement.orientation < 0
      ? { mateStart: placement.end - to, mateEnd: placement.end - from }
      : { mateStart: placement.start + from, mateEnd: placement.start + to }),
  }
}

/**
 * The panels a launch from the multiway display opens on: one per lane the
 * stack draws, in the stack's own order, each framed on what that lane
 * places of `region` on the contig its decision chose — the same answer the
 * discovery RPC gives from the dataset, read off the lanes instead. So the
 * launch keeps the lanes the reader picked and ordered, and on a graph
 * source it is not a second fetch over every haplotype the window places.
 *
 * A lane whose placements fall outside its fitted extent (the outlier rule)
 * contributes those placements to nothing, as the lane draws them nowhere;
 * a lane the settle has not framed has no panel yet. A lane the track
 * declares no assembly for is reported rather than dropped, as the RPC does.
 */
export function lanePanelsForRegion({
  groups,
  rowAssemblies,
  laneDecisions,
  region,
  trackAssemblyNames,
}: {
  groups: MultiWayGroup[]
  rowAssemblies: string[]
  laneDecisions: ReadonlyMap<string, LanePlacementDecision | undefined>
  region: { refName: string; start: number; end: number }
  trackAssemblyNames: string[]
}): MateDiscoveryResult {
  const mates: ResolvedPanel[] = []
  const unconfigured: string[] = []
  for (const assemblyName of rowAssemblies) {
    const decision = laneDecisions.get(assemblyName)
    if (decision !== undefined) {
      let anchorLo = Number.POSITIVE_INFINITY
      let anchorHi = Number.NEGATIVE_INFINITY
      let mateLo = Number.POSITIVE_INFINITY
      let mateHi = Number.NEGATIVE_INFINITY
      for (const group of groups) {
        const placed =
          group.anchor.refName === region.refName &&
          doesIntersect2(
            region.start,
            region.end,
            group.anchor.start,
            group.anchor.end,
          )
        for (const placement of placed
          ? (group.mates.get(assemblyName) ?? [])
          : []) {
          if (
            placement.refName === decision.refName &&
            doesIntersect2(
              decision.fitMin,
              decision.fitMax,
              placement.start,
              placement.end,
            )
          ) {
            const slice = mateSliceOf(group.anchor, placement, region)
            anchorLo = Math.min(anchorLo, slice.anchorStart)
            anchorHi = Math.max(anchorHi, slice.anchorEnd)
            mateLo = Math.min(mateLo, slice.mateStart)
            mateHi = Math.max(mateHi, slice.mateEnd)
          }
        }
      }
      if (anchorHi > anchorLo) {
        if (canLaunchSyntenyForMate(trackAssemblyNames, assemblyName)) {
          mates.push({
            assemblyName,
            refName: decision.refName,
            anchorStart: Math.floor(anchorLo),
            anchorEnd: Math.ceil(anchorHi),
            mateStart: Math.floor(mateLo),
            mateEnd: Math.ceil(mateHi),
            reversed: decision.flipped,
          })
        } else {
          unconfigured.push(assemblyName)
        }
      }
    }
  }
  return { mates, unconfigured }
}
