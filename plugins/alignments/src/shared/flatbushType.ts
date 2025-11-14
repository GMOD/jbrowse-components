export interface ReducedFeatureForFlatbush {
  name: string
  refName: string
  start: number
  end: number
  strand: number
  flags: number
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
}
