import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { drawMafBlocks } from './drawMafBlocks.ts'

import type {
  MafBackend,
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafBackendTypes.ts'

export class Canvas2DMafRenderer implements MafBackend {
  private canvas: HTMLCanvasElement
  // Only `regionData` is needed for Canvas2D rendering — the pre-encoded
  // GPU instance buffer in the payload is dropped here.
  private regions = new Map<number, MafRegionData>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  uploadRegion(displayedRegionIndex: number, data: MafUploadPayload) {
    this.regions.set(displayedRegionIndex, data.regionData)
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  renderBlocks(blocks: MafRenderBlock[], state: MafGPURenderState) {
    const ctx = this.canvas.getContext('2d')
    if (ctx) {
      prepareCanvas(this.canvas, ctx, state.canvasWidth, state.canvasHeight)
      drawMafBlocks(ctx, this.regions, blocks, state, createJBrowseTheme())
    }
  }

  dispose() {
    this.regions.clear()
  }
}
