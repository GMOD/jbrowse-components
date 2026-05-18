import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { drawMafBlocks } from './drawMafBlocks.ts'

import type {
  MafBackend,
  MafGPURenderState,
  MafRenderBlock,
  MafUploadPayload,
} from './mafBackendTypes.ts'

export class Canvas2DMafRenderer implements MafBackend {
  private canvas: HTMLCanvasElement
  private regions = new Map<number, MafUploadPayload>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  uploadRegion(displayedRegionIndex: number, data: MafUploadPayload) {
    this.regions.set(displayedRegionIndex, data)
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
