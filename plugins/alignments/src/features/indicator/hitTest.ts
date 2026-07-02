import { interbaseTypeName } from '../../shared/types.ts'

import type { IndicatorHitResult } from './types.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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
        indicatorType: interbaseTypeName(colorType ?? 1),
      }
    }
  }

  return undefined
}
