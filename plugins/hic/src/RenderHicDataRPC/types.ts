import type { HicFlatbushItem } from '../HicRenderer/types.ts'

export interface HicDataResult {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
  maxScore: number
  binWidth: number
  yScalar: number
  flatbush: ArrayBuffer
  items: HicFlatbushItem[]
}
