import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { PerRegionBackend } from '@jbrowse/core/gpu/perRegionBackend'

export interface ManhattanRenderState {
  domainY: [number, number]
  canvasWidth: number
  canvasHeight: number
}

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanBackend = PerRegionBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
