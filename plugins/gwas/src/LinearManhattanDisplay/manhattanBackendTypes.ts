import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { PerRegionGpuBackend } from '@jbrowse/core/gpu/perRegionBackend'
import type { WiggleRenderBlock } from '@jbrowse/wiggle-core'

export interface ManhattanRenderState {
  domainY: [number, number]
  canvasWidth: number
  canvasHeight: number
}

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanBackend = PerRegionGpuBackend<
  ManhattanRpcResult,
  ManhattanRenderState,
  WiggleRenderBlock
>
