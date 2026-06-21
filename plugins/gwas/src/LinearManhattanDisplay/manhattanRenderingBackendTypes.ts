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

// Map a score to its canvas Y (px from the top). Shared by the Canvas2D/SVG
// draw path and the hover hit-test so the drawn point and its grab target stay
// pixel-aligned; out-of-domain scores clamp to the top/bottom edge.
export function scoreToY(
  score: number,
  domainY: [number, number],
  canvasHeight: number,
) {
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1
  const norm = Math.max(0, Math.min(1, (score - domainMin) / range))
  return (1 - norm) * canvasHeight
}

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
