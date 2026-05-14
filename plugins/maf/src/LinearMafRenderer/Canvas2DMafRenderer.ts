import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { drawMafBlocks } from './drawMafBlocks.ts'

import type { MafBackend, MafGPURenderState, MafRegionData, MafRenderBlock } from './mafBackendTypes.ts'

export class Canvas2DMafRenderer implements MafBackend {
  private canvas: HTMLCanvasElement
  private regions = new Map<number, { regionData: MafRegionData }>()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  uploadRegion(
    displayedRegionIndex: number,
    _instanceBuffer: ArrayBuffer,
    _instanceCount: number,
    regionData: MafRegionData,
  ) {
    this.regions.set(displayedRegionIndex, { regionData })
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions)
  }

  renderBlocks(blocks: MafRenderBlock[], state: MafGPURenderState) {
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      return
    }
    prepareCanvas(this.canvas, ctx, state.canvasWidth, state.canvasHeight)
    drawMafBlocks(ctx, this.regions, blocks, state, createJBrowseTheme())
  }

  dispose() {
    this.regions.clear()
  }
}
