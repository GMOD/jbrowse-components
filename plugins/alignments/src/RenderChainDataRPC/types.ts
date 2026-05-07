import type { RenderPileupDataArgs } from '../RenderPileupDataRPC/types'

export interface RenderChainDataArgs extends RenderPileupDataArgs {
  drawSingletons?: boolean
  drawProperPairs?: boolean
}
