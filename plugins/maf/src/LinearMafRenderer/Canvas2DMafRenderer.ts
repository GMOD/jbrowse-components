import { paintMarkBlocks } from '@jbrowse/render-core/marks'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawMafCoverage } from './drawMafCoverage.ts'
import { MAF_ROW_MARKS } from './mafMarks.ts'

import type {
  MafGPURenderState,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'

export class Canvas2DMafRenderer extends Canvas2DPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState
> {
  protected draw(
    blocks: MafRenderBlock[],
    regions: ReadonlyMap<number, MafUploadPayload>,
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
      // The rows band, clipped out of the same canvas the GPU renderer scissors
      // it out of. Without the clip a scrolled row paints up into the coverage
      // strip above it — on the GPU that is the scissor's job, and here the
      // canvas edge used to do it, back when the canvas WAS the rows viewport.
      //
      // Clipped but not translated, so the mark paints in canvas space exactly
      // as the GPU pass does and one `scrollTop - rowsTop` serves both. The
      // per-block clip the painter takes intersects this one rather than
      // replacing it.
      this.ctx.save()
      try {
        this.ctx.beginPath()
        this.ctx.rect(0, rowsTop, canvasWidth, rowsHeight)
        this.ctx.clip()
        paintMarkBlocks(this.ctx, MAF_ROW_MARKS, regions, blocks, state)
      } finally {
        this.ctx.restore()
      }
    }
  }
}
