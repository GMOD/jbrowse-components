export interface HicFlatbushItem {
  bin1: number
  bin2: number
  counts: number
  region1Idx: number
  region2Idx: number
}

export interface HicDataResult {
  positions: Float32Array
  counts: Float32Array
  numContacts: number
  maxScore: number
  colorMaxScore: number
  binWidth: number
  flatbush: ArrayBuffer
  items: HicFlatbushItem[]
}
