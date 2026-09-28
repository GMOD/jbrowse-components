import { doesIntersect2 } from '@jbrowse/core/util'

import { canLaunchSyntenyForMate } from '../LaunchSyntenyView/canLaunchSyntenyForMate.ts'
import { mateSlice } from '../mateBpAt.ts'

import type { MateDiscoveryResult } from '../LaunchSyntenyView/pickMatesForRegion.ts'
import type { ResolvedPanel } from '../LaunchSyntenyView/resolvePanel.ts'
import type { LaneDecision } from './laneDecision.ts'
import type { MultiWayGroup } from './layoutMultiWay.ts'

export type LanePlacementDecision = Pick<
  LaneDecision,
  'refName' | 'fitMin' | 'fitMax' | 'flipped'
>

/** One panel per framed lane, in stack order, read off the lanes. */
export function lanePanelsForRegion({
  groups,
  rowAssemblies,
  laneDecisions,
  region,
  anchorCanon,
  trackAssemblyNames,
}: {
  groups: MultiWayGroup[]
  rowAssemblies: string[]
  laneDecisions: ReadonlyMap<string, LanePlacementDecision | undefined>
  region: { refName: string; start: number; end: number }
  anchorCanon: (refName: string) => string
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
          anchorCanon(group.anchor.refName) === region.refName &&
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
            const lo = Math.max(group.anchor.start, region.start)
            const hi = Math.min(group.anchor.end, region.end)
            const mate = mateSlice(
              group.anchor,
              placement,
              placement.orientation,
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
