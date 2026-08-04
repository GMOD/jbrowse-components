import { scoreToYPx } from './shaders/manhattan.js.generated.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

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

// Default point diameter — preserves the historical radius-2 disc. Also the
// value the track menu's "reset" returns to.
export const DEFAULT_POINT_DIAMETER_PX = 4

// Map a score to its canvas Y (px from the top). Shared by the Canvas2D/SVG
// draw path and the hover hit-test so the drawn point and its grab target stay
// pixel-aligned; out-of-domain scores clamp to the top/bottom edge.
//
// The mapping itself is manhattan.slang's `scoreToYPx`, generated into TS
// (adr-051); this is the tuple-taking wrapper both callers already use.
export function scoreToY(
  score: number,
  domainY: [number, number],
  canvasHeight: number,
) {
  return scoreToYPx(score, domainY[0], domainY[1], canvasHeight)
}

// Inverse of scoreToY (unclamped): canvas Y (px from top) → score. The hover
// hit-test derives its score query window from this, so the two must agree
// wherever the forward map is invertible — which is wherever the domain has a
// span, and there the `|| 1` below never fires. On a degenerate (min == max)
// domain the forward map is a step and has no inverse to be in lockstep with,
// so the guards differing there costs nothing.
export function yToScore(
  y: number,
  domainY: [number, number],
  canvasHeight: number,
) {
  const [domainMin, domainMax] = domainY
  const range = domainMax - domainMin || 1
  return domainMax - (y / canvasHeight) * range
}

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
