import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as multiRowShader from './shaders/multiRow.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/multiRow.iface.generated.ts'

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
      topology: 'triangle-list',
    }),
    // Pre-encoded on the main thread by the per-region encode autorun
    // (`buildMultiRowInstanceBuffer`, right-sized on return).
    pack: (data: MultiRowUploadPayload) => data.instanceBuffer,
  },
]

const U = UNIFORM_OFFSET_F32

export class GpuMultiRowRenderer extends GpuPerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  RenderBlock,
  MultiRowRegionData
> {
  private uniformF32: Float32Array
  protected regionPasses = MULTI_ROW_PASSES

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: MultiRowRegionData,
    state: MultiRowRenderState,
  ) {
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    // CSS px, not physical: `extendToMinWidthX` in rowRect.slang divides its
    // 1.0 by this to reach clip space, so a CSS width is what makes it a
    // 1-CSS-pixel minimum feature width, matching the Canvas2D Math.max(1,...)
    // path. clip.pxW is dpr-scaled, so on hi-DPI it would halve the min width.
    this.uniformF32[U.viewportWidth] = clip.scissorW
    this.uniformF32[U.zero] = 0
    this.uniformF32[U.rowHeight] = state.rowHeight
    this.uniformF32[U.rowProportion] = state.rowProportion
    // This display sizes its canvas to the whole row stack and never scrolls;
    // the shared rowRect scroll offset is MAF's.
    this.uniformF32[U.scrollTop] = 0

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
