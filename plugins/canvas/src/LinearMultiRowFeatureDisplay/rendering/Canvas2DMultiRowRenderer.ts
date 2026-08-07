import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawMultiRowBlocks } from './drawMultiRowBlocks.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowUploadPayload,
} from './multiRowRenderingBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

export class Canvas2DMultiRowRenderer extends Canvas2DPerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  RenderBlock,
  MultiRowRegionData
> {
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, MultiRowRegionData>,
    state: MultiRowRenderState,
  ) {
    drawMultiRowBlocks(this.ctx, regions, blocks, state)
  }
}
