import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DBackend } from '@jbrowse/core/gpu/perRegionBackend'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { drawMafBlocks } from './drawMafBlocks.ts'

import type {
  MafBackend,
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafBackendTypes.ts'

export class Canvas2DMafRenderer extends Canvas2DBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  renderBlocks(
    blocks: MafRenderBlock[],
    regions: ReadonlyMap<number, MafRegionData>,
    state: MafGPURenderState,
  ) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    drawMafBlocks(this.ctx, regions, blocks, state, createJBrowseTheme())
  }
}
