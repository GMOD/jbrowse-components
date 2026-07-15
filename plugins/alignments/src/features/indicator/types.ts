import type { InterbaseTypeName } from '../../shared/types.ts'

export interface IndicatorHitResult {
  type: 'indicator'
  position: number
  indicatorType: InterbaseTypeName
}
