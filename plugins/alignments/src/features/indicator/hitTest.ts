import { INTERBASE_TYPES } from './types.ts'

import type { IndicatorHitResult, InterbaseType } from './types.ts'
import type { ResolvedBlock } from '../../LinearAlignmentsDisplay/components/hitTesting.ts'

function getInterbaseTypeName(colorType: number): InterbaseType {
  return INTERBASE_TYPES[(colorType - 1) % 3] ?? 'insertion'
}

export function hitTestIndicator(
  canvasX: number,
  canvasY: number,
  resolved: ResolvedBlock | undefined,
  showCoverage: boolean,
  showInterbaseIndicators: boolean,
): IndicatorHitResult | undefined {
  if (!showCoverage || !showInterbaseIndicators || canvasY > 5 || !resolved) {
    return undefined
  }

  const blockData = resolved.rpcData
  const { bpRange, blockStartPx, blockWidth, reversed } = resolved
  const bpPerPx = (bpRange[1] - bpRange[0]) / blockWidth
  const frac = (canvasX - blockStartPx) / blockWidth
  const genomicPos = reversed
    ? bpRange[1] - frac * (bpRange[1] - bpRange[0])
    : bpRange[0] + frac * (bpRange[1] - bpRange[0])
  const hitToleranceBp = Math.max(1, bpPerPx * 5)

  const { indicatorPositions, indicatorColorTypes } = blockData
  const numIndicators = indicatorPositions.length

  for (let i = 0; i < numIndicators; i++) {
    const pos = indicatorPositions[i]
    if (pos !== undefined && Math.abs(genomicPos - pos) < hitToleranceBp) {
      const colorType = indicatorColorTypes[i]
      return {
        type: 'indicator',
        position: pos,
        indicatorType: getInterbaseTypeName(colorType ?? 1),
      }
    }
  }

  return undefined
}
