import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
  reversed: boolean
}

export interface CanvasFeatureBackend {
  uploadRegion(regionNumber: number, data: RegionRenderData): void
  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ): void
  pruneRegions(activeRegions: number[]): void
  dispose(): void
}
