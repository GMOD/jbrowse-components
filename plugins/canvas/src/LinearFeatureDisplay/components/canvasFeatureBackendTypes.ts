export interface FeatureRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
}

export interface CanvasFeatureBackend {
  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      rectPositions: Uint32Array
      rectYs: Float32Array
      rectHeights: Float32Array
      rectColors: Uint8Array
      numRects: number
      linePositions: Uint32Array
      lineYs: Float32Array
      lineColors: Uint8Array
      lineDirections: Int8Array
      numLines: number
      arrowXs: Uint32Array
      arrowYs: Float32Array
      arrowDirections: Int8Array
      arrowHeights: Float32Array
      arrowColors: Uint8Array
      numArrows: number
    },
  ): void
  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ): void
  pruneStaleRegions(activeRegions: number[]): void
  dispose(): void
}
