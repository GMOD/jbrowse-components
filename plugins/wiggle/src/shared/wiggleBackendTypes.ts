export interface WiggleGPURenderState {
  domainY: [number, number]
  scaleType: number
  renderingType: number
  canvasWidth: number
  canvasHeight: number
}

export interface WiggleRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

export interface SourceRenderData {
  featurePositions: Uint32Array
  featureScores: Float32Array
  numFeatures: number
  color: [number, number, number]
  rowIndex?: number
}

export interface WiggleBackend {
  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(
    blocks: WiggleRenderBlock[],
    renderState: WiggleGPURenderState,
  ): void
  dispose(): void
}
