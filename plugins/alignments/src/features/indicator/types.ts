export const INTERBASE_TYPES = ['insertion', 'softclip', 'hardclip'] as const
export type InterbaseType = (typeof INTERBASE_TYPES)[number]

export interface IndicatorHitResult {
  type: 'indicator'
  position: number
  indicatorType: InterbaseType
}
