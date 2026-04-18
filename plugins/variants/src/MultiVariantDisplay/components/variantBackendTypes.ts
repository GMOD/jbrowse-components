import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export type { RenderBlock as VariantRenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface VariantBackend {
  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint32Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(
    blocks: RenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ): void
  dispose(): void
}
