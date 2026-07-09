import { INDICATOR_TRIANGLE_H, coverageLayout } from '@jbrowse/alignments-core'

import { interbaseTypeName } from '../../shared/types.ts'

import type { IndicatorHitResult } from './types.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Horizontal slack (px) so the 1px-wide interbase bars are practical to hover.
const BAR_HIT_HALF_WIDTH_PX = 3
// Vertical slack (px) below the drawn bar bottom.
const BAR_HIT_PAD_PX = 2

// Index of the interbase position nearest genomicPos within tolerance, or -1.
function nearestPositionIndex(
  positions: Uint32Array,
  genomicPos: number,
  toleranceBp: number,
) {
  let best = -1
  let bestDist = Infinity
  for (let i = 0; i < positions.length; i++) {
    const dist = Math.abs(genomicPos - positions[i]!)
    if (dist < toleranceBp && dist < bestDist) {
      bestDist = dist
      best = i
    }
  }
  return best
}

// Hovering the interbase histogram — the stacked insertion/softclip/hardclip
// bars in the coverage band, plus the indicator triangles at significant
// positions — resolves to an interbase tooltip. The coverage-depth area below
// the bars stays a plain coverage hit. Bars are drawn whenever coverage is
// shown; the triangles are additionally gated on showInterbaseIndicators.
export function hitTestInterbase(
  genomicPos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showCoverage: boolean,
  showInterbaseIndicators: boolean,
  coverageHeight: number,
  domainMax: number | undefined,
): IndicatorHitResult | undefined {
  let hit: IndicatorHitResult | undefined

  // Indicator triangles: significant positions only, in the top strip.
  if (
    showCoverage &&
    showInterbaseIndicators &&
    canvasY >= 0 &&
    canvasY <= INDICATOR_TRIANGLE_H
  ) {
    const { indicatorPositions, indicatorColorTypes } = rpcData
    const idx = nearestPositionIndex(
      indicatorPositions,
      genomicPos,
      Math.max(1, bpPerPx * 5),
    )
    if (idx >= 0) {
      hit = {
        type: 'indicator',
        position: indicatorPositions[idx]!,
        indicatorType: interbaseTypeName(indicatorColorTypes[idx] ?? 1),
      }
    }
  }

  // Interbase histogram bars: every interbase position, matched against the
  // actual drawn bar rectangle (top strip down to the stacked bar bottom, the
  // same geometry as drawInterbaseSegments).
  if (
    !hit &&
    showCoverage &&
    domainMax !== undefined &&
    domainMax > 0 &&
    rpcData.interbaseMaxCount > 0 &&
    canvasY >= 0
  ) {
    const {
      interbaseCovPositions,
      interbaseCovYOffsets,
      interbaseCovHeights,
      interbaseCovColorTypes,
      interbaseMaxCount,
    } = rpcData
    const nearestIdx = nearestPositionIndex(
      interbaseCovPositions,
      genomicPos,
      bpPerPx * BAR_HIT_HALF_WIDTH_PX,
    )
    if (nearestIdx >= 0) {
      const pos = interbaseCovPositions[nearestIdx]!
      const interbaseHeight =
        (coverageLayout(coverageHeight).effectiveH / 2) *
        (interbaseMaxCount / domainMax)
      // Tallest stacked point at this position and its dominant (tallest
      // segment) type.
      let maxYEnd = 0
      let dominantType = 1
      let dominantHeight = 0
      for (let i = 0; i < interbaseCovPositions.length; i++) {
        if (interbaseCovPositions[i] === pos) {
          const yEnd = interbaseCovYOffsets[i]! + interbaseCovHeights[i]!
          if (yEnd > maxYEnd) {
            maxYEnd = yEnd
          }
          if (interbaseCovHeights[i]! > dominantHeight) {
            dominantHeight = interbaseCovHeights[i]!
            dominantType = interbaseCovColorTypes[i]!
          }
        }
      }
      const barBottomPx = INDICATOR_TRIANGLE_H + maxYEnd * interbaseHeight
      if (canvasY <= barBottomPx + BAR_HIT_PAD_PX) {
        hit = {
          type: 'indicator',
          position: pos,
          indicatorType: interbaseTypeName(dominantType),
        }
      }
    }
  }

  return hit
}
