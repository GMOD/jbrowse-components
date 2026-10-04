import type { LDDataResult } from '../../RenderLDDataRPC/types.ts'
import type { TriangleFrame } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

/** The part of the payload the marks draw from. */
export type LDUploadData = Pick<
  LDDataResult,
  | 'ldValues'
  | 'boundaries'
  | 'numCells'
  | 'band'
  | 'uniformW'
  | 'metric'
  | 'positions'
  | 'cellSizes'
>

/** The frame plus the `color` object's ramp and domain. */
export interface LDRenderState extends TriangleFrame {
  domainMin: number
  domainMax: number
  colorRamp: Uint8Array
}

export type LDRenderingBackend = PerRegionRenderingBackend<
  LDUploadData,
  LDRenderState
>
