import {
  cloneWithLayout,
  withoutLayout,
} from '../RenderAlignmentDataRPC/sortLayout.ts'
import { overlapIntervals } from './spanOverlaps.ts'

import type {
  LaidOutPileupData,
  WorkerPileupData,
} from '../RenderAlignmentDataRPC/types.ts'
import type { Span } from './spanOverlaps.ts'

// Lay a group out as a single row: every feature sits on row 0 and paints over
// the ones it overlaps, with the overlap tint layer carrying the depth. One lane
// per group, so an all-vs-all synteny track shows one thin band per mate genome
// instead of one stack per mate genome.
//
// Depth is drawn, not stacked. `overlapIntervals` emits a position covered by
// `d` features exactly `d - 1` times (see spanOverlaps.ts), and the tint blends
// alpha, so a segment darkens monotonically with how many alignments cover it —
// a repeat family that hits 22 mate loci reads as one dark tick rather than 22
// identical rectangles claiming 22 rows.
//
// No packing pass runs at all: `placeRect` exists to find a free row, and there
// is only one. That also means nothing can be clipped, which is why this takes
// no row cap.

// A group is one row tall exactly when some region of it has a feature. Shared
// by the map builder and the count-only fit-height pass so the two can't
// disagree on a group's height.
export function collapsedLayoutMaxY(
  dataMap: ReadonlyMap<number, WorkerPileupData>,
) {
  for (const data of dataMap.values()) {
    if (data.readKeys.length > 0) {
      return 1
    }
  }
  return 0
}

// Exon spans, not read extents. `readPositions` is the read's full aligned
// extent, intron included, so a spliced read tinted its own introns as covered
// — a solid depth bar with the 1px junction line sitting on it, disagreeing
// with the coverage histogram directly above, which subtracts skips. Segments
// are the spans `drawReads` paints, and two segments of one read cannot overlap
// each other, so the depth stays right.
function readSpans({
  segmentPositions,
  numSegments,
}: WorkerPileupData): Span[] {
  return Array.from({ length: numSegments }, (_, i) => ({
    start: segmentPositions[i * 2]!,
    end: segmentPositions[i * 2 + 1]!,
  }))
}

// The tint instances for one region: one per (depth - 1) at each position, all
// on row 0. Packed straight into the `overlap*` arrays the existing chain-mode
// tint pass already renders on both backends.
function collapsedOverlaps(data: WorkerPileupData) {
  const overlaps = overlapIntervals(readSpans(data))
  const overlapPositions = new Uint32Array(overlaps.length * 2)
  for (const [i, { start, end }] of overlaps.entries()) {
    overlapPositions[i * 2] = start
    overlapPositions[i * 2 + 1] = end
  }
  return { overlapPositions, overlapYs: new Uint16Array(overlaps.length) }
}

export function buildCollapsedPileupMap(
  dataMap: ReadonlyMap<number, WorkerPileupData>,
): Map<number, LaidOutPileupData> {
  const maxY = collapsedLayoutMaxY(dataMap)
  const out = new Map<number, LaidOutPileupData>()
  for (const [idx, data] of dataMap) {
    if (data.readKeys.length === 0) {
      out.set(idx, withoutLayout(data))
    } else {
      const overlaps = collapsedOverlaps(data)
      out.set(idx, {
        // Row 0 for every feature, by construction: an all-zero readYs is the
        // layout, so there is no placement step that could disagree with maxY.
        //
        // `'collapse'` is the "there is more here than one row shows" signal the
        // group label reads to offer its expand affordance — recorded exactly
        // when features actually overlap, since a sparse lane loses nothing to
        // the collapse and needs no affordance. It is a cap like the other three:
        // one row, and the chip expands out of it.
        ...cloneWithLayout(
          data,
          new Uint16Array(data.readKeys.length),
          maxY,
          overlaps.overlapYs.length > 0 ? 'collapse' : undefined,
        ),
        ...overlaps,
      })
    }
  }
  return out
}
