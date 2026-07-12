import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import { RENDERING_TYPE_LINE } from './wiggleComponentUtils.ts'
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

const U = wiggleShader.UNIFORM_OFFSET_F32

// One shader, two triangle-list passes sharing the same vertex buffer.
// PASS_FILL draws xyplot / density / scatter / linecenter as 6-vert quads (the
// center-line's one ribbon per feature fits the same 6-vert quad); PASS_LINE
// draws the thick step-line as 18 verts per feature (3 square-capped quad segments)
// so stroke thickness honors the lineWidth uniform (line-list topology can't —
// its width is hard-locked to 1px on WebGPU/WebGL).
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
    // Upload once to PASS_FILL; PASS_LINE shares the same buffer via drawPass
    this.hal.uploadBuffer(displayedRegionIndex, PASS_FILL, buf, totalFeatures)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _sources: SourceRenderData[],
    state: WiggleGPURenderState,
  ) {
    const passId =
      state.renderingType === RENDERING_TYPE_LINE ? PASS_LINE : PASS_FILL

    const [bpHi, bpLo, bpLen] = bpRangeXTuple(clip, block.reversed)
    this.uniformF32[U.bpRangeX] = bpHi
    this.uniformF32[U.bpRangeX + 1] = bpLo
    this.uniformF32[U.bpRangeX + 2] = bpLen
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
