import type { ReducedFeature } from './fetchChains'

export interface FlatbushEntry {
  x1: number
  y1: number
  x2: number
  y2: number
  data: ReducedFeature
  chainId: string
  chainMinX: number
  chainMaxX: number
  chain: ReducedFeature[]
}
