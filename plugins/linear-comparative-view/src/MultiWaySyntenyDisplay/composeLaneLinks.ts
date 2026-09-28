import { SimpleFeature } from '@jbrowse/core/util'

import { mateSlice } from '../mateBpAt.ts'
import { composeAlignmentOps } from './composeAlignmentOps.ts'

import type { LaneLinks } from './alignmentOps.ts'
import type { ComposeCursors } from './composeAlignmentOps.ts'
import type { Feature } from '@jbrowse/core/util'

/** `strand` -1 means the anchor's start maps to the lane's end. */
export interface LanePlacementRecord {
  anchorRefName: string
  anchorStart: number
  anchorEnd: number
  refName: string
  start: number
  end: number
  strand: 1 | -1
  feature: Feature
  ops?: Uint32Array
}

export interface ComposeLaneLinksOpts {
  upper: LanePlacementRecord[]
  lower: LanePlacementRecord[]
  upperAssemblyName: string
  lowerAssemblyName: string
  minBp?: number
}

function byAnchor(a: LanePlacementRecord, b: LanePlacementRecord) {
  return a.anchorRefName < b.anchorRefName
    ? -1
    : a.anchorRefName > b.anchorRefName
      ? 1
      : a.anchorStart - b.anchorStart
}

function projectOntoLane(
  record: LanePlacementRecord,
  anchorStart: number,
  anchorEnd: number,
) {
  return mateSlice(
    { start: record.anchorStart, end: record.anchorEnd },
    record,
    record.strand,
    anchorStart,
    anchorEnd,
  )
}

function stillOpen(active: LanePlacementRecord[], next: LanePlacementRecord) {
  return active.filter(
    record =>
      record.anchorRefName === next.anchorRefName &&
      record.anchorEnd > next.anchorStart,
  )
}

/** Links in the direct lane-link shape: `refName` upper, `mate` lower. */
export function composeLaneLinks({
  upper,
  lower,
  upperAssemblyName,
  lowerAssemblyName,
  minBp = 1,
}: ComposeLaneLinksOpts): LaneLinks {
  const upperSorted = [...upper].sort(byAnchor)
  const lowerSorted = [...lower].sort(byAnchor)
  const links: SimpleFeature[] = []
  const ops = new Map<string, Uint32Array>()
  const cursors: ComposeCursors = new Map()
  let activeUpper: LanePlacementRecord[] = []
  let activeLower: LanePlacementRecord[] = []

  const emit = (u: LanePlacementRecord, l: LanePlacementRecord) => {
    const s = Math.max(u.anchorStart, l.anchorStart)
    const e = Math.min(u.anchorEnd, l.anchorEnd)
    if (e - s >= minBp) {
      const composed = composeAlignmentOps(u, l, s, e, cursors)
      const upperSpan = composed
        ? { start: composed.upperStart, end: composed.upperEnd }
        : projectOntoLane(u, s, e)
      const lowerSpan = composed
        ? { start: composed.lowerStart, end: composed.lowerEnd }
        : projectOntoLane(l, s, e)
      const uniqueId = `composed:${u.feature.id()}@${u.start}-${u.end}|${l.feature.id()}@${l.start}-${l.end}|${u.anchorRefName}:${s}-${e}`
      if (composed) {
        ops.set(uniqueId, composed.ops)
      }
      links.push(
        new SimpleFeature({
          uniqueId,
          assemblyName: upperAssemblyName,
          refName: u.refName,
          start: upperSpan.start,
          end: upperSpan.end,
          strand: u.strand * l.strand,
          type: 'match',
          composedThrough: { refName: u.anchorRefName, start: s, end: e },
          mate: {
            assemblyName: lowerAssemblyName,
            refName: l.refName,
            start: lowerSpan.start,
            end: lowerSpan.end,
          },
        }),
      )
    }
  }

  let i = 0
  let j = 0
  while (i < upperSorted.length || j < lowerSorted.length) {
    const u = upperSorted[i]
    const l = lowerSorted[j]
    if (u !== undefined && (l === undefined || byAnchor(u, l) <= 0)) {
      activeLower = stillOpen(activeLower, u)
      for (const open of activeLower) {
        emit(u, open)
      }
      activeUpper.push(u)
      i++
    } else if (l !== undefined) {
      activeUpper = stillOpen(activeUpper, l)
      for (const open of activeUpper) {
        emit(open, l)
      }
      activeLower.push(l)
      j++
    }
  }
  return { links, ops }
}
