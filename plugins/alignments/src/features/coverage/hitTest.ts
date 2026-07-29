import { findSignificantInBin } from '@jbrowse/alignments-core'

import type { CoverageHitResult } from './types.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// `basePos` is the integer base under the cursor (canvasXToBasePos), not a
// floored fractional position: bins are 1bp-indexed off coverageStartPos, and
// on a reversed block flooring names the neighbouring base.
export function hitTestCoverage(
  basePos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showCoverage: boolean,
  coverageHeight: number,
): CoverageHitResult | undefined {
  if (!showCoverage || canvasY > coverageHeight) {
    return undefined
  }

  const { coverageDepths, coverageStartPos } = rpcData
  const binIndex = basePos - coverageStartPos
  if (binIndex < 0 || binIndex >= coverageDepths.length) {
    return undefined
  }

  const binStart = coverageStartPos + binIndex
  if (bpPerPx > 1) {
    const binEnd = binStart + Math.ceil(bpPerPx)
    const snpHit = findSignificantInBin(
      rpcData.mismatchPositions,
      coverageDepths,
      coverageStartPos,
      binStart,
      binEnd,
      0.05,
    )
    if (snpHit !== undefined) {
      return { type: 'coverage', position: snpHit }
    }
    // Interbase events are no longer surfaced through the coverage tooltip — they
    // are hit-tested directly on the histogram bars (hitTestInterbase) — so the
    // coverage bin doesn't snap to them.
  }

  return { type: 'coverage', position: binStart }
}
