import { canvasToGenomicCoords } from './alignmentComponentUtils.ts'
import {
  hitTestChain as hitTestChainFn,
  hitTestCigarItem as hitTestCigarItemFn,
  hitTestCoverage as hitTestCoverageFn,
  hitTestFeature as hitTestFeatureFn,
  hitTestIndicator as hitTestIndicatorFn,
} from './hitTesting.ts'
import { hitTestModification as hitTestModificationFn } from '../../features/modification/hitTest.ts'

import type {
  CigarHitResult,
  CoverageHitResult,
  IndicatorHitResult,
  ModificationHitResult,
  ResolvedBlock,
} from './hitTesting.ts'

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
    // Indicator hits (triangles at top of coverage)
    const indicatorHit = hitTestIndicatorFn(
      canvasX,
      canvasY,
      resolved,
      showCoverage,
      showInterbaseIndicators,
    )
    if (indicatorHit && resolved) {
      return { type: 'indicator', hit: indicatorHit, resolved }
    }

    // Coverage area hits
    const coverageHit = hitTestCoverageFn(
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

  // CIGAR item hits (on top of reads)
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
    // Modification hit testing before CIGAR: in modification mode a modified+
    // mismatched base should resolve as a modification hit, not a mismatch hit.
    // When not in modification mode modFlatbush is undefined so this is a no-op.
    const modificationHit =
      resolved && coords
        ? hitTestModificationFn(resolved, coords, featureHeightSetting)
        : undefined
    if (modificationHit && resolved && coords) {
      return {
        type: 'modification',
        hit: modificationHit,
        featureHit: hitTestFeatureFn(
          canvasX,
          canvasY,
          resolved,
          coords,
          featureHeightSetting,
        ),
        cigarHit: hitTestCigarItemFn(resolved, coords, featureHeightSetting),
        resolved,
      }
    }

    const cigarHit =
      resolved && coords
        ? hitTestCigarItemFn(resolved, coords, featureHeightSetting)
        : undefined
    if (cigarHit && resolved) {
      // Also get the feature hit for the underlying read
      const featureHit = coords
        ? hitTestFeatureFn(
            canvasX,
            canvasY,
            resolved,
            coords,
            featureHeightSetting,
          )
        : undefined
      return {
        type: 'cigar',
        hit: cigarHit,
        featureHit,
        resolved,
      }
    }
  }

  // Feature/chain hit testing
  const hit = isChainMode
    ? hitTestChainFn(coords, resolved?.rpcData)
    : resolved && coords
      ? hitTestFeatureFn(
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
