import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'

export interface ManhattanRenderState {
  domainY: [number, number]
  canvasWidth: number
  canvasHeight: number
}

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
