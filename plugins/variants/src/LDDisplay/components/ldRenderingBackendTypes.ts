import type { LDDataResult } from '../../RenderLDDataRPC/types.ts'
import type { MatrixColorState } from '@jbrowse/display-kit/MatrixRampMixin'
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
  | 'positions'
  | 'cellSizes'
>

/** The frame plus `encoding.color` as the painters read it. */
export interface LDRenderState extends TriangleFrame {
  color: MatrixColorState
}

export type LDRenderingBackend = PerRegionRenderingBackend<
  LDUploadData,
  LDRenderState
>
