import { doesIntersect2 } from '@jbrowse/core/util'

import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/canLaunchSyntenyForMate.ts'
import { NO_OPS } from './alignmentOps.ts'
import { laneGenome } from './copyLane.ts'
import { placementMateInterval } from './layoutMultiWay.ts'

import type { MateDiscoveryResult } from '../LaunchSyntenyView/pickMatesForRegion.ts'
import type { ResolvedPanel } from '../LaunchSyntenyView/resolvePanel.ts'
import type { AlignmentOpsById } from './alignmentOps.ts'
import type { LaneDecision } from './laneDecision.ts'
import type { MultiWayGroup } from './layoutMultiWay.ts'

export type LanePlacementDecision = Pick<
  LaneDecision,
  'refName' | 'fitMin' | 'fitMax' | 'flipped'
>

/** One panel per framed lane, in stack order, read off the lanes. */
export function lanePanelsForRegion({
  groups,
  ops = NO_OPS,
  rowAssemblies,
  laneDecisions,
  region,
  anchorCanon,
  trackAssemblyNames,
  laneKey = assemblyName => assemblyName,
}: {
  groups: MultiWayGroup[]
  ops?: AlignmentOpsById
  rowAssemblies: string[]
  laneDecisions: ReadonlyMap<string, LanePlacementDecision | undefined>
  region: { refName: string; start: number; end: number }
  anchorCanon: (refName: string) => string
  trackAssemblyNames: string[]
  /** the canonical name, so a lane matches the track under any spelling */
  laneKey?: (assemblyName: string) => string
}): MateDiscoveryResult {
  const launchable = trackAssemblyNames.map(laneKey)
  const mates: ResolvedPanel[] = []
  const unconfigured: string[] = []
  for (const lane of rowAssemblies) {
    const assemblyName = laneGenome(lane)
    const decision = laneDecisions.get(lane)
    if (decision !== undefined) {
      let anchorLo = Number.POSITIVE_INFINITY
      let anchorHi = Number.NEGATIVE_INFINITY
      let mateLo = Number.POSITIVE_INFINITY
      let mateHi = Number.NEGATIVE_INFINITY
      for (const group of groups) {
        const placed =
          anchorCanon(group.anchor.refName) === region.refName &&
          doesIntersect2(
            region.start,
            region.end,
            group.anchor.start,
            group.anchor.end,
          )
        for (const placement of placed ? (group.mates.get(lane) ?? []) : []) {
          if (
            placement.refName === decision.refName &&
            doesIntersect2(
              decision.fitMin,
              decision.fitMax,
              placement.start,
              placement.end,
            )
          ) {
            const lo = Math.max(group.anchor.start, region.start)
            const hi = Math.min(group.anchor.end, region.end)
            // unrounded, so the panel's ends round outward once below
            const mate = placementMateInterval(
              group.anchor,
              placement,
              ops,
              lo,
              hi,
            )
            anchorLo = Math.min(anchorLo, lo)
            anchorHi = Math.max(anchorHi, hi)
            mateLo = Math.min(mateLo, mate.start)
            mateHi = Math.max(mateHi, mate.end)
          }
        }
      }
      if (anchorHi > anchorLo) {
        if (canLaunchSyntenyForMate(launchable, laneKey(assemblyName))) {
          mates.push({
            assemblyName,
            refName: decision.refName,
            anchorStart: Math.floor(anchorLo),
            anchorEnd: Math.ceil(anchorHi),
            mateStart: Math.floor(mateLo),
            mateEnd: Math.ceil(mateHi),
            reversed: decision.flipped,
          })
        } else if (!unconfigured.includes(assemblyName)) {
          unconfigured.push(assemblyName)
        }
      }
    }
  }
  return { mates, unconfigured }
}
