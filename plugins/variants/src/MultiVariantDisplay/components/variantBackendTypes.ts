export interface VariantRenderBlock {
  regionNumber: number
  bpRangeX: [number, number]
  screenStartPx: number
  screenEndPx: number
  reversed: boolean
}

export interface VariantBackend {
  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint8Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(
    blocks: VariantRenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ): void
  dispose(): void
}
