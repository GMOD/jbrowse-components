import type { TriangleFrame } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'

export interface HicRenderState extends TriangleFrame {
  domainMin: number
  domainMax: number
  scaleType: ScaleTypeCode
  colorRamp: Uint8Array
}

// `binWidth` is the payload's, so a frame never scales one fetch's bins by
// another's geometry. `instances` is the shader's own vertex layout.
export interface HicUploadData {
  instances: Float32Array
  numContacts: number
  binWidth: number
}

export type HicRenderingBackend = PerRegionRenderingBackend<
  HicUploadData,
  HicRenderState
>
