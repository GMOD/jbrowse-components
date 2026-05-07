import { canvasToGenomicCoords } from './alignmentComponentUtils.ts'
import { hitTestCoverage } from '../../features/coverage/hitTest.ts'
import { hitTestGap } from '../../features/gap/hitTest.ts'
import { hitTestIndicator } from '../../features/indicator/hitTest.ts'
import {
  hitTestLargeInsertion,
  hitTestSmallInsertion,
} from '../../features/insertion/hitTest.ts'
import { hitTestMismatch } from '../../features/mismatch/hitTest.ts'
import { hitTestModification } from '../../features/modification/hitTest.ts'
import { hitTestFeature } from '../../features/read/hitTest.ts'
import { hitTestClip } from '../../shared/clipPass.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { CoverageHitResult } from '../../features/coverage/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type {
  CigarCoords,
  CigarHitResult,
  ResolvedBlock,
} from '../../shared/hitTestTypes.ts'

export type HitTestResult =
  | { type: 'indicator'; hit: IndicatorHitResult; resolved: ResolvedBlock }
  | { type: 'coverage'; hit: CoverageHitResult; resolved: ResolvedBlock }
  | {
      type: 'cigar'
      hit: CigarHitResult
      featureHit?: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | {
      type: 'modification'
      hit: ModificationHitResult
      featureHit?: { id: string; index: number }
      cigarHit?: CigarHitResult
      resolved: ResolvedBlock
    }
  | {
      type: 'feature'
      hit: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | { type: 'none' }

// Above ~50kbp visible region (2000px / 50000bp = 25), per-base detail is
// too zoomed out to be meaningful.
export const SNP_HIT_MAX_BP_PER_PX = 25

function hitTestChain(coords: CigarCoords, rpcData: PileupDataResult) {
  if (!rpcData.chainFlatbush || !rpcData.chainFirstReadIndices) {
    return undefined
  }
  const { adjustedY, genomicPos, row } = coords
  if (adjustedY < 0) {
    return undefined
  }
  const hits = rpcData.chainFlatbush.search(genomicPos, row, genomicPos, row)
  if (hits.length === 0) {
    return undefined
  }
  const readIdx = rpcData.chainFirstReadIndices[hits[0]!]!
  return { id: rpcData.readIds[readIdx]!, index: readIdx }
}

export interface HitTestOptions {
  showCoverage: boolean
  showInterbaseIndicators: boolean
  coverageHeight: number
  topOffset: number
  featureHeightSetting: number
  featureSpacing: number
  rangeY: [number, number]
  isChainMode: boolean
}

// Priority chain across CIGAR features, top-down:
//  1. large insertions (wide boxes that overlap SNPs)
//  2. mismatches (1bp features under the cursor base)
//  3. small insertions (thin bars that don't overlap SNPs)
//  4. gaps (deletions/skips spanning the read body)
//  5. softclips, then hardclips (interbase bars at alignment edges)
function hitTestCigarItem(
  resolved: ResolvedBlock,
  coords: CigarCoords,
  featureHeightSetting: number,
): CigarHitResult | undefined {
  const { adjustedY, yWithinRow } = coords
  if (adjustedY < 0 || yWithinRow > featureHeightSetting) {
    return undefined
  }
  return (
    hitTestLargeInsertion(resolved, coords) ??
    hitTestMismatch(resolved, coords) ??
    hitTestSmallInsertion(resolved, coords) ??
    hitTestGap(resolved, coords) ??
    hitTestClip(resolved, coords, 'softclip') ??
    hitTestClip(resolved, coords, 'hardclip')
  )
}

export function performHitTest(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  options: HitTestOptions,
): HitTestResult {
  const {
    showCoverage,
    showInterbaseIndicators,
    coverageHeight,
    topOffset,
    featureHeightSetting,
    featureSpacing,
    rangeY,
    isChainMode,
  } = options

  if (resolved) {
    // Single site for the canvas-X → genomicPos transform.
    // reversed is handled here and nowhere else in the hit-test pipeline.
    const bpSpan = resolved.bpRange[1] - resolved.bpRange[0]
    const bpPerPx = bpSpan / resolved.blockWidth
    const frac = (canvasX - resolved.blockStartPx) / resolved.blockWidth
    const genomicPos = resolved.reversed
      ? resolved.bpRange[1] - frac * bpSpan
      : resolved.bpRange[0] + frac * bpSpan

    // Indicator and coverage tooltips work at all zoom levels.
    // hitTestIndicator fires only in the top-5px indicator strip (zoom-safe).
    // hitTestCoverage handles zoomed-out bins: returns the bin position and
    // snaps to any significant SNP/insertion within the bin when bpPerPx > 1.
    const indicatorHit = hitTestIndicator(
      genomicPos,
      bpPerPx,
      canvasY,
      resolved.rpcData,
      showCoverage,
      showInterbaseIndicators,
    )
    if (indicatorHit) {
      return { type: 'indicator', hit: indicatorHit, resolved }
    }

    const coverageHit = hitTestCoverage(
      genomicPos,
      bpPerPx,
      canvasY,
      resolved.rpcData,
      showCoverage,
      coverageHeight,
    )
    if (coverageHit) {
      return { type: 'coverage', hit: coverageHit, resolved }
    }

    const coords = canvasToGenomicCoords(
      canvasY,
      genomicPos,
      bpPerPx,
      featureHeightSetting,
      featureSpacing,
      topOffset,
      rangeY,
    )

    if (bpPerPx <= SNP_HIT_MAX_BP_PER_PX) {
      // Modification before CIGAR: a modified+mismatched base resolves as a
      // modification hit, not a mismatch hit. modFlatbush is undefined when
      // not in modification mode so this is a no-op.
      const modificationHit = hitTestModification(
        resolved,
        coords,
        featureHeightSetting,
      )
      const cigarHit = hitTestCigarItem(resolved, coords, featureHeightSetting)
      if (modificationHit) {
        return {
          type: 'modification',
          hit: modificationHit,
          featureHit: hitTestFeature(resolved, coords, featureHeightSetting),
          cigarHit,
          resolved,
        }
      }
      if (cigarHit) {
        return {
          type: 'cigar',
          hit: cigarHit,
          featureHit: hitTestFeature(resolved, coords, featureHeightSetting),
          resolved,
        }
      }
    } else if (
      coords.adjustedY >= 0 &&
      coords.yWithinRow <= featureHeightSetting
    ) {
      // When zoomed out, surface features that are still visually significant.
      // Mirror hitTestCigarItem's adjustedY/yWithinRow guards so inter-row
      // spacing doesn't produce false hits.
      const largeInsertionHit = hitTestLargeInsertion(resolved, coords)
      if (largeInsertionHit) {
        return { type: 'cigar', hit: largeInsertionHit, resolved }
      }
      const gapHit = hitTestGap(resolved, coords)
      if (gapHit && (gapHit.length ?? 0) >= bpPerPx) {
        return { type: 'cigar', hit: gapHit, resolved }
      }
    }

    const hit = isChainMode
      ? hitTestChain(coords, resolved.rpcData)
      : hitTestFeature(resolved, coords, featureHeightSetting)
    if (hit) {
      return { type: 'feature', hit, resolved }
    }
  }

  return { type: 'none' }
}
