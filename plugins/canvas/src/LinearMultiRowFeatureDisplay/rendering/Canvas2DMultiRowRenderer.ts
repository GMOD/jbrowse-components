import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import { drawMultiRowBlocks } from './drawMultiRowBlocks.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderBlock,
  MultiRowRenderState,
  MultiRowUploadPayload,
} from './multiRowRenderingBackendTypes.ts'

export class Canvas2DMultiRowRenderer extends Canvas2DPerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  MultiRowRenderBlock,
  MultiRowRegionData
> {
  protected draw(
    blocks: MultiRowRenderBlock[],
    regions: ReadonlyMap<number, MultiRowRegionData>,
    state: MultiRowRenderState,
  ) {
    drawMultiRowBlocks(this.ctx, regions, blocks, state)
  }
}
