import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type { RenderBlock as FeatureRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface RenderState {
  scrollY: number
  canvasWidth: number
  canvasHeight: number
}

export interface CanvasFeatureBackend {
  uploadRegion(displayedRegionIndex: number, data: RegionRenderData): void
  renderBlocks(blocks: RenderBlock[], state: RenderState): void
  pruneRegions(activeRegions: number[]): void
  dispose(): void
}
