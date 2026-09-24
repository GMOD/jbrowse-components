import type { ManhattanChannels, ManhattanRequest } from './manhattanLayer.ts'
import type { HitIndexed } from '@jbrowse/core/util/markEncoding'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

/**
 * One region's points as the display holds them, with the request they came
 * back under. A payload no worker fetch produced holds no request.
 */
export type StoredManhattanData = HitIndexed<ManhattanChannels> & {
  request?: ManhattanRequest
}

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

export type ManhattanRenderingBackend = PerRegionRenderingBackend<
  ManhattanChannels,
  ManhattanRenderState
>
