import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export interface ManhattanRenderState {
  domainY: [number, number]
  canvasWidth: number
  canvasHeight: number
}

// Point radius in CSS pixels, shared by both backends so the Canvas2D and GPU
// renderers (and SVG export) draw identically sized points. Separate from
// findManhattanHit's larger HIT_RADIUS_PX grab tolerance.
export const POINT_RADIUS_PX = 2

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
