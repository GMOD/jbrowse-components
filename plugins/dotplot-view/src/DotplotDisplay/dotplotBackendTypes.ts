import type { ViewProjection } from '@jbrowse/core/util/bpProjection'

export interface DotplotTrackProjection {
  displayKey: number
  projH: ViewProjection
  projV: ViewProjection
}

export interface DotplotGeometryData {
  // bp-in-region for each segment endpoint. Renderers project against
  // per-view ViewProjection tables to get screen pixels. See
  // @jbrowse/core/util/bpProjection.
  x1s: Uint32Array
  y1s: Uint32Array
  x2s: Uint32Array
  y2s: Uint32Array
  xRegionIdx: Uint8Array
  yRegionIdx: Uint8Array
  colors: Uint32Array
  instanceCount: number
}

export interface DotplotRenderState {
  lineWidth: number
  trackProjections: readonly DotplotTrackProjection[]
}

export interface DotplotBackend {
  resize(width: number, height: number): void
  uploadGeometry(displayKey: number, data: DotplotGeometryData): void
  deleteGeometry(displayKey: number): void
  render(state: DotplotRenderState): void
  dispose(): void
}
