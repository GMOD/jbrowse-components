export interface ReducedFeatureForFlatbush {
  name: string
  refName: string
  start: number
  end: number
  strand: number
  flags: number
  id: string
  tlen: number
  pair_orientation: string
  clipLengthAtStartOfRead: number
  next_ref?: string
}

export interface FlatbushEntry {
  x1: number
  y1: number
  x2: number
  y2: number
  data: ReducedFeatureForFlatbush
  chainId: string
  chainMinX: number
  chainMaxX: number
  chain: ReducedFeatureForFlatbush[]
  hasSupplementary: boolean
}
