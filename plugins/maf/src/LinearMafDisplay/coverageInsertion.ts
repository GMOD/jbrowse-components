import { buildCoverageTooltipBin, insertionBarWidth } from '@jbrowse/alignments-core'

import type { MafCoverageRegion } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'

export interface CoverageInsertionHit {
  position: number
  count: number
  minLen: number
  maxLen: number
  interbaseDepth: number
}

/**
 * Hit-test an insertion (interbase) bar in the coverage band. Insertions are
 * anchored at a base boundary, so the nearest boundary (`round(gposFrac)`) is
 * tested and gated on pixel proximity — the same narrow target the sample-area
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
  const anchor = Math.round(gposFrac)
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
