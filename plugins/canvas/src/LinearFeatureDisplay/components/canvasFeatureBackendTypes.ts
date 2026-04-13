import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

export type { RenderBlock as FeatureRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface CanvasFeatureBackend {
  uploadRegion(regionNumber: number, data: RegionRenderData): void
  renderBlocks(
    blocks: RenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ): void
  pruneRegions(activeRegions: number[]): void
  dispose(): void
}
