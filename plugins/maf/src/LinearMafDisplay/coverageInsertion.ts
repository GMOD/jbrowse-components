import {
  SNP_TOOLTIP_SNAP_FLOOR,
  buildCoverageTooltipBin,
  findSignificantInBin,
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

/**
 * Genomic position of the most significant SNP in the pixel under the cursor,
 * or undefined at base-level zoom and where nothing in the pixel qualifies.
 *
 * Zoomed out a pixel spans many bp, so the exact cursor position rarely lands on
 * the SNP coordinate; the tooltip reports the dominant event in the pixel
 * instead (mirrors alignments' `hitTestCoverage`), and depth still falls back to
 * the exact position when none qualifies.
 *
 * `basePos` is the base painted under the cursor (`basePaintedAt`), and
 * `reversed` is the region's orientation, which decides which SIDE of it the
 * pixel's other bp lie on: a forward region's pixel runs right from that base, a
 * reversed one's runs left. Widening rightward either way searched the
 * neighbouring pixel's bp on a flipped region and named a SNP the cursor was not
 * over, silently, because a plausible SNP came back.
 *
 * The threshold is the shared floor, not a second literal `0.05` under a comment
 * saying it mirrors alignments. This band has no allele-fraction setting to
 * raise it with, so the floor is the whole threshold here — where alignments
 * also passes its band's own floor per allele.
 */
export function coverageSnpSnap(
  coverage: Pick<
    MafCoverageRegion,
    'mismatchPositions' | 'coverageDepths' | 'coverageStartPos'
  >,
  basePos: number,
  bpPerPx: number,
  reversed = false,
) {
  if (bpPerPx <= 1) {
    return undefined
  }
  // Half-open [from, to) over the bp this pixel covers, anchored on the base
  // under the cursor and extending away from it in the direction bp runs.
  const width = Math.ceil(bpPerPx)
  const from = reversed ? basePos - width + 1 : basePos
  return findSignificantInBin(
    coverage.mismatchPositions,
    coverage.coverageDepths,
    coverage.coverageStartPos,
    from,
    from + width,
    SNP_TOOLTIP_SNAP_FLOOR,
  )
}
