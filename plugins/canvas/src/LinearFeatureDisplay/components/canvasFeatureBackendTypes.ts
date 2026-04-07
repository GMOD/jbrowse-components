import type { RegionGpuData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
  reversed: boolean
}

export interface CanvasFeatureBackend {
  uploadRegion(regionNumber: number, data: RegionGpuData): void
  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ): void
  pruneStaleRegions(activeRegions: number[]): void
  dispose(): void
}
