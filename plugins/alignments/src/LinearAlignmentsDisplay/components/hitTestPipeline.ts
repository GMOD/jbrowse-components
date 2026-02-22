import { canvasToGenomicCoords } from './alignmentComponentUtils.ts'
import {
  hitTestChain as hitTestChainFn,
  hitTestCigarItem as hitTestCigarItemFn,
  hitTestCoverage as hitTestCoverageFn,
  hitTestFeature as hitTestFeatureFn,
  hitTestIndicator as hitTestIndicatorFn,
  hitTestSashimiArc as hitTestSashimiArcFn,
} from './hitTesting.ts'

import type {
  CigarHitResult,
  CoverageHitResult,
  IndicatorHitResult,
  ResolvedBlock,
  SashimiArcHitResult,
} from './hitTesting.ts'

export type HitTestResult =
  | { type: 'indicator'; hit: IndicatorHitResult; resolved: ResolvedBlock }
  | { type: 'sashimi'; hit: SashimiArcHitResult }
  | { type: 'coverage'; hit: CoverageHitResult; resolved: ResolvedBlock }
  | {
      type: 'cigar'
      hit: CigarHitResult
      featureHit?: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | {
      type: 'feature'
      hit: { id: string; index: number }
      resolved: ResolvedBlock
    }
  | { type: 'none' }

export interface HitTestOptions {
  showCoverage: boolean
  showInterbaseIndicators: boolean
  showSashimiArcs: boolean
  coverageHeight: number
  topOffset: number
  featureHeightSetting: number
  featureSpacing: number
  rangeY: [number, number]
  isChainMode: boolean
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
    showSashimiArcs,
    coverageHeight,
    topOffset,
    featureHeightSetting,
    featureSpacing,
    rangeY,
    isChainMode,
  } = options

  // 1. Indicator hits (triangles at top of coverage)
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

  // 2. Sashimi arc hits
  const sashimiHit = hitTestSashimiArcFn(
    canvasX,
    canvasY,
    resolved,
    showCoverage,
    showSashimiArcs,
    coverageHeight,
  )
  if (sashimiHit) {
    return { type: 'sashimi', hit: sashimiHit }
  }

  // 3. Coverage area hits
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

  // 4. CIGAR item hits (on top of reads)
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
      featureHit: featureHit ?? undefined,
      resolved,
    }
  }

  // 5. Feature/chain hit testing
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
