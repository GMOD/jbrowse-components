import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

export interface ManhattanRenderState {
  domainY: [number, number]
  canvasWidth: number
  canvasHeight: number
}

// Manhattan-specific backend interface. Intentionally NOT WiggleBackend —
// GWAS data is 1:1 points, not binned/pos/neg arrays, so we upload the raw
// RPC result without going through wiggle's SourceRenderData encoder.
export interface ManhattanBackend {
  uploadRegion(displayedRegionIndex: number, data: ManhattanRpcResult): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(
    blocks: WiggleRenderBlock[],
    state: ManhattanRenderState,
  ): void
  dispose(): void
}
