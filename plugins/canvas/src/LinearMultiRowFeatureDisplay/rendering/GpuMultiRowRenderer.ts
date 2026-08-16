import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as multiRowShader from './shaders/multiRow.generated.ts'
import { UNIFORMS_SIZE_BYTES } from './shaders/multiRow.iface.generated.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderState,
  MultiRowUploadPayload,
} from './multiRowRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS_RECT = 'rect'

export const MULTI_ROW_PASSES = [
  {
    ...slangPass({
      id: PASS_RECT,
      mod: multiRowShader,
    }),
    // Pre-encoded on the main thread by the per-region encode autorun
    // (`buildMultiRowInstanceBuffer`, right-sized on return).
    pack: (data: MultiRowUploadPayload) => data.instanceBuffer,
  },
]

export class GpuMultiRowRenderer extends GpuPerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  RenderBlock,
  MultiRowRegionData
> {
  protected regionPasses = MULTI_ROW_PASSES

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: MultiRowRegionData,
    state: MultiRowRenderState,
  ) {
    multiRowShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      // CSS px, not physical: `extendToMinWidthX` in rowRect.slang divides its
      // 1.0 by this to reach clip space, so a CSS width is what makes it a
      // 1-CSS-pixel minimum feature width, matching the Canvas2D Math.max(1,...)
      // path. clip.pxW is dpr-scaled, so on hi-DPI it would halve the min width.
      viewportWidth: clip.scissorW,
      zero: 0,
      rowHeight: state.rowHeight,
      rowProportion: state.rowProportion,
      // This display sizes its canvas to the whole row stack and never scrolls;
      // the shared rowRect scroll offset is MAF's.
      scrollTop: 0,
    })

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
