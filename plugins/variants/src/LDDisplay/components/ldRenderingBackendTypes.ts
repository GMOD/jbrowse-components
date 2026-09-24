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

export type LDRenderingBackend = PerRegionRenderingBackend<
  LDUploadData,
  TriangleFrame
>
