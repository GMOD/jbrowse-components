import type { InterbaseIndicatorItem } from './types.ts'

export function createInterbaseItem(
  maxBase: string,
  count: number,
  total: number,
  start: number,
  maxEntry?: {
    avgLength?: number
    minLength?: number
    maxLength?: number
    topSequence?: string
  },
): InterbaseIndicatorItem {
  return {
    type: maxBase as 'insertion' | 'softclip' | 'hardclip',
    base: maxBase,
    count,
    total,
    avgLength: maxEntry?.avgLength,
    minLength: maxEntry?.minLength,
    maxLength: maxEntry?.maxLength,
    topSequence: maxEntry?.topSequence,
    start,
  }
}
