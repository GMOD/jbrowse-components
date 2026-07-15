import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

export type { RenderBlock as FeatureRenderBlock } from '@jbrowse/render-core/renderBlock'

export interface RenderState {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}

export type CanvasFeatureRenderingBackend = PerRegionRenderingBackend<
  RegionRenderData,
  RenderState
>
