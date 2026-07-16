import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import {
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
} from './wiggleComponentUtils.ts'
import { interleaveInstances } from './wiggleInstanceBuffer.ts'

import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'

const PASS_FILL = 'fill'
const PASS_LINE = 'line'
const PASS_LINE_CENTER = 'lineCenter'

const U = wiggleShader.UNIFORM_OFFSET_F32

// One shader, three triangle-list passes sharing the same vertex buffer.
// PASS_FILL draws xyplot / density / scatter as 6-vert quads; PASS_LINE draws
// the thick step-line as 18 verts per feature (3 square-capped quad segments) so
// stroke thickness honors the lineWidth uniform (line-list topology can't — its
// width is hard-locked to 1px on WebGPU/WebGL); PASS_LINE_CENTER draws the
// connect-points line as a 6-vert capsule per feature under max blend.
const LINE_VERTS_PER_INSTANCE = 18

export const WIGGLE_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_FILL,
    mod: wiggleShader,
    topology: 'triangle-list',
  }),
  slangPass({
    id: PASS_LINE,
    mod: wiggleShader,
    topology: 'triangle-list',
    verticesPerInstance: LINE_VERTS_PER_INSTANCE,
  }),
  // Center-line: one 6-vert quad per feature (shares PASS_FILL's buffer). Drawn
  // with premultiplied MAX blend so the analytic-AA ribbon's overlapping
  // segments and caps union (take the higher coverage) instead of accumulating
  // into dark seams under standard src-over. Valid because the target clears to
  // transparent black and only this pass draws in center-line mode.
  slangPass({
    id: PASS_LINE_CENTER,
    mod: wiggleShader,
    topology: 'triangle-list',
    blendState: { srcFactor: 'one', dstFactor: 'one', op: 'max' },
  }),
]

export class GpuWiggleRenderer
  extends GpuPerRegionRenderingBackend<SourceRenderData[], WiggleGPURenderState>
  implements WiggleRenderingBackend
{
  private uniformF32: Float32Array
  private uniformI32: Int32Array

  constructor(hal: GpuHal) {
    super(hal, wiggleShader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformI32 = new Int32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, sources: SourceRenderData[]) {
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }
    if (totalFeatures === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      return
    }
    const buf = interleaveInstances(sources, totalFeatures)
    // Upload once to PASS_FILL; PASS_LINE and PASS_LINE_CENTER read the same
    // buffer via drawPass's bufferPassId.
    this.hal.uploadBuffer(displayedRegionIndex, PASS_FILL, buf, totalFeatures)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _sources: SourceRenderData[],
    state: WiggleGPURenderState,
  ) {
    const passId =
      state.renderingType === RENDERING_TYPE_LINE
        ? PASS_LINE
        : state.renderingType === RENDERING_TYPE_LINE_CENTER
          ? PASS_LINE_CENTER
          : PASS_FILL

    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    this.uniformI32[U.scaleType] = state.scaleType
    this.uniformI32[U.renderingType] = state.renderingType
    this.uniformF32[U.numRows] = state.numRows
    this.uniformF32[U.domainYMin] = state.domainY[0]
    this.uniformF32[U.domainYMax] = state.domainY[1]
    // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
    this.uniformF32[U.zero] = 0
    // viewportWidth stays in CSS units to match canvasHeight (per CLAUDE.md
    // GPU conventions). The shader's `minClipW = 3 / viewportWidth` therefore
    // resolves to a stable 1.5 CSS px floor across DPRs, matching
    // WIGGLE_MIN_PX in the Canvas2D path.
    this.uniformF32[U.viewportWidth] = clip.scissorW
    this.uniformF32[U.scatterPointSize] = state.scatterPointSize
    this.uniformF32[U.lineWidth] = state.lineWidth

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(passId, block.displayedRegionIndex, PASS_FILL)
  }
}
