import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { PerRegionBackend } from '@jbrowse/core/gpu/perRegionBackend'

export type { RenderBlock as FeatureRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface RenderState {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}

export type CanvasFeatureBackend = PerRegionBackend<
  RegionRenderData,
  RenderState
>
