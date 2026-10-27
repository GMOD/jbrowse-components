import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export interface RenderState {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
  outlineColor: number
  hideChevrons?: boolean
}

export type CanvasFeatureRenderingBackend = PerRegionRenderingBackend<
  RegionRenderData,
  RenderState
>
