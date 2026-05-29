import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { PerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'

export type { RenderBlock as FeatureRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface RenderState {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}

export type CanvasFeatureRenderingBackend = PerRegionRenderingBackend<
  RegionRenderData,
  RenderState
>
