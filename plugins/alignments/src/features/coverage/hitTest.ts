import {
  SNP_TOOLTIP_SNAP_FLOOR,
  findSignificantInBin,
} from '@jbrowse/alignments-core'

import type { CoverageHitResult } from './types.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// `basePos` is the integer base under the cursor (canvasXToBasePos), not a
// floored fractional position: bins are 1bp-indexed off coverageStartPos, and
// on a reversed block flooring names the neighbouring base.
//
// `reversed` is the block's orientation, and it is needed for a second reason
// beyond the one `canvasXToBasePos` already handles: the SNP snap below widens
// `basePos` into the bp the CURSOR'S PIXEL covers, and which side of `basePos`
// those bp lie on is exactly what the orientation decides. A forward block's
// pixel runs right from the base under the cursor; a reversed block's runs
// left. Widening rightward either way searched the neighbouring pixel's bp on a
// flipped view — so the tooltip snapped to a SNP the cursor was not over, by up
// to one pixel's worth of bp, and did it silently because a plausible SNP came
// back.
export function hitTestCoverage(
  basePos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showCoverage: boolean,
  coverageHeight: number,
  reversed = false,
  coverageSnpMinFrequency = 0,
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
    // Half-open [from, to) over the bp this pixel covers, anchored on the base
    // under the cursor and extending away from it in the direction bp runs.
    const width = Math.ceil(bpPerPx)
    const from = reversed ? binStart - width + 1 : binStart
    const snpHit = findSignificantInBin(
      rpcData.mismatchPositions,
      coverageDepths,
      coverageStartPos,
      from,
      from + width,
      // The band's own allele-fraction floor, never below the snap floor. The
      // threshold was a bare `SNP_TOOLTIP_SNAP_FLOOR` from before the band had
      // a setting, so at `coverageSnpMinFrequency` 0.2 the tooltip named a 10%
      // SNP that `drawSnpSegments` and snpCoverage.slang had both declined to
      // colour — a hover answering for a segment that is not on screen.
      Math.max(SNP_TOOLTIP_SNAP_FLOOR, coverageSnpMinFrequency),
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
