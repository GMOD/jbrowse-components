import { INTERBASE_TYPES } from './types.ts'

import type { IndicatorHitResult, InterbaseType } from './types.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

function getInterbaseTypeName(colorType: number): InterbaseType {
  return INTERBASE_TYPES[(colorType - 1) % 3] ?? 'insertion'
}

export function hitTestIndicator(
  genomicPos: number,
  bpPerPx: number,
  canvasY: number,
  rpcData: PileupDataResult,
  showCoverage: boolean,
  showInterbaseIndicators: boolean,
): IndicatorHitResult | undefined {
  if (!showCoverage || !showInterbaseIndicators || canvasY > 5) {
    return undefined
  }

  const hitToleranceBp = Math.max(1, bpPerPx * 5)
  const { indicatorPositions, indicatorColorTypes } = rpcData
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
