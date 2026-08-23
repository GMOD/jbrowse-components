import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawMafBlocks } from './drawMafBlocks.ts'
import { drawMafCoverage } from './drawMafCoverage.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'

export class Canvas2DMafRenderer extends Canvas2DPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  protected draw(
    blocks: MafRenderBlock[],
    regions: ReadonlyMap<number, MafRegionData>,
    state: MafGPURenderState,
  ) {
    const { coverage, rowsTop, rowsHeight, canvasWidth } = state
    if (coverage) {
      drawMafCoverage(this.ctx, blocks, regions, {
        coverageHeight: coverage.height,
        canvasWidth,
        domainMax: coverage.domainMax,
        colors: coverage.colors,
      })
    }
    if (rowsHeight > 0) {
      // The rows band, offset and clipped out of the same canvas the GPU
      // renderer scissors it out of. Without the clip a scrolled row paints up
      // into the coverage strip above it — on the GPU that is the scissor's job,
      // and here the canvas edge used to do it, back when the canvas WAS the
      // rows viewport.
      this.ctx.save()
      try {
        this.ctx.beginPath()
        this.ctx.rect(0, rowsTop, canvasWidth, rowsHeight)
        this.ctx.clip()
        this.ctx.translate(0, rowsTop)
        drawMafBlocks(this.ctx, regions, blocks, state)
      } finally {
        this.ctx.restore()
      }
    }
  }
}
