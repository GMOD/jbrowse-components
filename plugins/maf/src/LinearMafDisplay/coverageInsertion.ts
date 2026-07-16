import {
  buildCoverageTooltipBin,
  insertionBarWidth,
} from '@jbrowse/alignments-core'

import type { MafCoverageRegion } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface CoverageInsertionHit {
  position: number
  count: number
  minLen: number
  maxLen: number
  interbaseDepth: number
}

// Genomic position of the insertion event nearest `gposFrac`, or undefined when
// there are none. Insertions sit at exact base boundaries, but when zoomed out a
// single pixel spans many bp, so `round(gposFrac)` rarely lands on the exact
// insertion coordinate — we instead snap to the closest recorded insertion so
// the bar stays hoverable at any zoom (mirrors alignments' `hitTestCoverage`
// bin scan). The pixel-proximity gate below still rejects far snaps.
//
// `positions` is emitted in ascending order by the worker's block walk (see
// `computeMafCoverage`), so binary search for the insertion point and compare
// only the two neighbors — this runs on every mousemove over the coverage band.
function nearestInsertionPosition(positions: Uint32Array, gposFrac: number) {
  if (positions.length === 0) {
    return undefined
  }
  let lo = 0
  let hi = positions.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (positions[mid]! < gposFrac) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  // `lo` is the first position >= gposFrac; the nearest is it or its predecessor.
  const after = positions[lo]
  const before = positions[lo - 1]
  if (after === undefined) {
    return before
  }
  if (before === undefined) {
    return after
  }
  return gposFrac - before <= after - gposFrac ? before : after
}

/**
 * Hit-test an insertion (interbase) bar in the coverage band. Insertions are
 * anchored at a base boundary. When zoomed in (`bpPerPx <= 1`) the rounded
 * cursor boundary is the exact insertion coordinate; when zoomed out a pixel
 * spans many bp so `round(gposFrac)` would miss it, and we snap to the nearest
 * recorded insertion instead (mirroring alignments' bin scan). Either way the
 * result is gated on pixel proximity — the same narrow target the sample-area
 * insertion marker uses — so the depth/SNP hover is not hijacked near
 * insertions. The aggregate (count/length range) + interbaseDepth come from the
 * shared `buildCoverageTooltipBin`, so MAF and alignments summarize insertions
 * the same way.
 */
export function coverageInsertionAt(
  coverage: MafCoverageRegion,
  gposFrac: number,
  bpPerPx: number,
): CoverageInsertionHit | undefined {
  const anchor =
    bpPerPx > 1
      ? nearestInsertionPosition(coverage.insertionPositions, gposFrac)
      : Math.round(gposFrac)
  if (anchor === undefined) {
    return undefined
  }
  const bin = buildCoverageTooltipBin(
    anchor,
    {
      coverageDepths: coverage.coverageDepths,
      coverageStartPos: coverage.coverageStartPos,
    },
    {
      mismatchPositions: coverage.mismatchPositions,
      mismatchBases: coverage.mismatchBases,
    },
    {
      interbasePositions: coverage.insertionPositions,
      interbaseLengths: coverage.insertionLengths,
    },
    anchor,
  )
  let hit: CoverageInsertionHit | undefined
  if (bin) {
    const insertion = bin.interbase.insertion
    if (insertion) {
      // Narrow pixel target around the boundary, matching the sample-area marker.
      const rectWidthPx = insertionBarWidth(insertion.maxLen, 1 / bpPerPx) + 4
      const halfBp = (rectWidthPx / 2) * bpPerPx
      if (Math.abs(gposFrac - anchor) <= halfBp) {
        hit = {
          position: anchor,
          count: insertion.count,
          minLen: insertion.minLen,
          maxLen: insertion.maxLen,
          interbaseDepth: bin.interbaseDepth,
        }
      }
    }
  }
  return hit
}
