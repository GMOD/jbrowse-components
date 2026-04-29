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

// Hit test for a chain (linked-read group) using the Flatbush spatial index
// built during chain layout. Returns the first read in the hit chain.
function hitTestChain(
  coords: CigarCoords | undefined,
  rpcData: PileupDataResult | undefined,
) {
  if (!coords || !rpcData?.chainFlatbush || !rpcData.chainFirstReadIndices) {
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
  bpPerPx: number
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
    bpPerPx,
  } = options

  const detailedHitsEnabled = bpPerPx <= SNP_HIT_MAX_BP_PER_PX

  if (detailedHitsEnabled) {
    const indicatorHit = hitTestIndicator(
      canvasX,
      canvasY,
      resolved,
      showCoverage,
      showInterbaseIndicators,
    )
    if (indicatorHit && resolved) {
      return { type: 'indicator', hit: indicatorHit, resolved }
    }

    const coverageHit = hitTestCoverage(
      canvasX,
      canvasY,
      resolved,
      showCoverage,
      coverageHeight,
    )
    if (coverageHit && resolved) {
      return { type: 'coverage', hit: coverageHit, resolved }
    }
  }

  const coords = resolved
    ? canvasToGenomicCoords(
        canvasX,
        canvasY,
        resolved,
        featureHeightSetting,
        featureSpacing,
        topOffset,
        rangeY,
      )
    : undefined

  if (detailedHitsEnabled) {
    // Modification before CIGAR: a modified+mismatched base resolves as a
    // modification hit, not a mismatch hit. modFlatbush is undefined when
    // not in modification mode so this is a no-op.
    const modificationHit =
      resolved && coords
        ? hitTestModification(resolved, coords, featureHeightSetting)
        : undefined
    if (modificationHit && resolved && coords) {
      return {
        type: 'modification',
        hit: modificationHit,
        featureHit: hitTestFeature(
          canvasX,
          canvasY,
          resolved,
          coords,
          featureHeightSetting,
        ),
        cigarHit: hitTestCigarItem(resolved, coords, featureHeightSetting),
        resolved,
      }
    }

    const cigarHit =
      resolved && coords
        ? hitTestCigarItem(resolved, coords, featureHeightSetting)
        : undefined
    if (cigarHit && resolved) {
      const featureHit = coords
        ? hitTestFeature(
            canvasX,
            canvasY,
            resolved,
            coords,
            featureHeightSetting,
          )
        : undefined
      return { type: 'cigar', hit: cigarHit, featureHit, resolved }
    }
  }

  const hit = isChainMode
    ? hitTestChain(coords, resolved?.rpcData)
    : resolved && coords
      ? hitTestFeature(
          canvasX,
          canvasY,
          resolved,
          coords,
          featureHeightSetting,
        )
      : undefined
  if (hit && resolved) {
    return { type: 'feature', hit, resolved }
  }

  return { type: 'none' }
}
