import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { HitIndexed } from '@jbrowse/core/util/markEncoding'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type StoredManhattanData = HitIndexed<ManhattanRpcResult>

export interface ManhattanRenderState {
  domainY: [number, number]
  canvasWidth: number
  canvasHeight: number
  // Point diameter in CSS pixels (user-configurable via scatterPointSize),
  // threaded through state so Canvas2D, GPU and SVG export all draw identically
  // sized points. Separate from findManhattanHit's larger HIT_RADIUS_PX grab
  // tolerance.
  pointDiameterPx: number
}

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
