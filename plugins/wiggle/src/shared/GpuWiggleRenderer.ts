import { clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { GpuPerRegionBackend } from '@jbrowse/core/gpu/perRegionBackend'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as wiggleShader from './shaders/wiggle.generated.ts'
import { RENDERING_TYPE_LINE } from './wiggleComponentUtils.ts'
import { computeNumRows, interleaveInstances } from './wiggleInstanceBuffer.ts'

import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
} from '@jbrowse/wiggle-core'

const PASS_FILL = 'fill'
const PASS_LINE = 'line'

const U = wiggleShader.UNIFORM_OFFSET_F32

// One shader, two passes: same vertex buffer, different primitive topology.
// PASS_LINE draws the score polyline via line-list; PASS_FILL draws xyplot /
// density / scatter quads via triangle-list.
export const WIGGLE_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_FILL,
    mod: wiggleShader,
    topology: 'triangle-list',
  }),
  slangPass({
    id: PASS_LINE,
    mod: wiggleShader,
    topology: 'line-list',
  }),
]

export class GpuWiggleRenderer
  extends GpuPerRegionBackend<SourceRenderData[], WiggleGPURenderState>
  implements WiggleBackend
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

  renderBlocks(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, SourceRenderData[]>,
    state: WiggleGPURenderState,
  ) {
    const { canvasWidth, canvasHeight } = state
    const dpr = getDpr()

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const passId =
      state.renderingType === RENDERING_TYPE_LINE ? PASS_LINE : PASS_FILL

    for (const block of blocks) {
      const sources = regions.get(block.displayedRegionIndex)
      if (!sources) {
        continue
      }
      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      this.uniformF32[U.bpRangeX] = clip.bpStartHi
      this.uniformF32[U.bpRangeX + 1] = clip.bpStartLo
      this.uniformF32[U.bpRangeX + 2] = clip.clippedLengthBp
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformI32[U.scaleType] = state.scaleType
      this.uniformI32[U.renderingType] = state.renderingType
      this.uniformF32[U.numRows] = computeNumRows(sources)
      this.uniformF32[U.domainYMin] = state.domainY[0]
      this.uniformF32[U.domainYMax] = state.domainY[1]
      // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
      this.uniformF32[U.zero] = 0
      // viewportWidth stays in CSS units to match canvasHeight (per CLAUDE.md
      // GPU conventions). The shader's `minClipW = 3 / viewportWidth` therefore
      // resolves to a stable 1.5 CSS px floor across DPRs, matching
      // WIGGLE_MIN_PX in the Canvas2D path.
      this.uniformF32[U.viewportWidth] = clip.scissorW
      this.uniformF32[U.reversed] = block.reversed ? 1 : 0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(passId, block.displayedRegionIndex, PASS_FILL)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }
}
