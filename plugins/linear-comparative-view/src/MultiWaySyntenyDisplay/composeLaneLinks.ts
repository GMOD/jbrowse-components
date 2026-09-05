import { SimpleFeature } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

/**
 * One lane's placement of a record against the anchor: the anchor interval it
 * covers and the interval of the lane's own contig it maps to. `strand` is the
 * pair's orientation, -1 meaning the anchor's start maps to the lane's end.
 */
export interface LanePlacementRecord {
  anchorRefName: string
  anchorStart: number
  anchorEnd: number
  refName: string
  start: number
  end: number
  strand: 1 | -1
  feature: Feature
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
  const scale =
    (record.end - record.start) / (record.anchorEnd - record.anchorStart)
  const from = (anchorStart - record.anchorStart) * scale
  const to = (anchorEnd - record.anchorStart) * scale
  return record.strand === -1
    ? { start: Math.round(record.end - to), end: Math.round(record.end - from) }
    : {
        start: Math.round(record.start + from),
        end: Math.round(record.start + to),
      }
}

function stillOpen(active: LanePlacementRecord[], next: LanePlacementRecord) {
  return active.filter(
    record =>
      record.anchorRefName === next.anchorRefName &&
      record.anchorEnd > next.anchorStart,
  )
}

/**
 * The links between two adjacent mate lanes that a star of pairwise
 * alignments never states directly, composed through the anchor: wherever an
 * upper-lane record and a lower-lane record cover the same stretch of the
 * anchor, that stretch is mapped into each lane by linear interpolation within
 * its record and emitted as one link in the shape the display's direct
 * lane-link features have — `refName`/`start`/`end` in the upper lane,
 * `mate` in the lower, `strand` the product of the two orientations.
 *
 * A sweep over both lists in anchor order with an active set per side, so the
 * work is the sort plus one step per overlapping pair. Intersections shorter
 * than `minBp` are skipped.
 */
export function composeLaneLinks({
  upper,
  lower,
  upperAssemblyName,
  lowerAssemblyName,
  minBp = 1,
}: ComposeLaneLinksOpts) {
  const upperSorted = [...upper].sort(byAnchor)
  const lowerSorted = [...lower].sort(byAnchor)
  const links: SimpleFeature[] = []
  let activeUpper: LanePlacementRecord[] = []
  let activeLower: LanePlacementRecord[] = []

  const emit = (u: LanePlacementRecord, l: LanePlacementRecord) => {
    const s = Math.max(u.anchorStart, l.anchorStart)
    const e = Math.min(u.anchorEnd, l.anchorEnd)
    if (e - s >= minBp) {
      const upperSpan = projectOntoLane(u, s, e)
      const lowerSpan = projectOntoLane(l, s, e)
      links.push(
        new SimpleFeature({
          uniqueId: `composed:${u.feature.id()}@${u.start}-${u.end}|${l.feature.id()}@${l.start}-${l.end}|${u.anchorRefName}:${s}-${e}`,
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
  return links
}
