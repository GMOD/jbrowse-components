import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type Flatbush from '@jbrowse/core/util/flatbush'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

/** A region's payload as the display stores it: the hit-test index wrapped once at the commit. */
export type StoredManhattanData = ManhattanRpcResult & { flatbush?: Flatbush }

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

// GWAS data is 1:1 points (raw RPC result), not binned via wiggle's
// SourceRenderData encoder, so Manhattan specializes the shared per-region
// backend contract directly on `ManhattanRpcResult`.
export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanRpcResult,
  ManhattanRenderState
>
