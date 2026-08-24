// #exampleFile gpu | extends GpuPerRegionRenderingBackend; packs instances, writes uniforms
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS = 'score'
const U = shader.UNIFORM_OFFSET_F32
const UU = shader.UNIFORM_OFFSET_U32

// A pass is its shader plus the function that fills its instance buffer. Six
// vertices per instance = two triangles, so the boxes need a triangle-list
// topology. Exported so the factory can hand the pass list to the HAL.
//
// You write no upload: the base class packs every pass in `regionPasses` and
// hands the bytes to the HAL, taking the instance count from the buffer's own
// length. Nothing to keep in agreement, and an empty pack releases the buffer.
export const SCORE_PASSES = [
  {
    ...slangPass({ id: PASS, mod: shader }),
    // the generated packInstances interleaves the parallel arrays into the
    // GL_ATTRIBUTES layout, no manual DataView offsets
    pack: (data: ScoreRegionData) =>
      shader.packInstances(
        { startBp: data.starts, endBp: data.ends, score: data.scores },
        data.numFeatures,
      ),
  },
]

export class GpuScoreRenderer extends GpuPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  private uniformF32: Float32Array
  private uniformU32: Uint32Array
  protected regionPasses = SCORE_PASSES

  constructor(hal: GpuHal) {
    // the base allocates the reusable this.uniformData scratch buffer
    super(hal, shader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformU32 = new Uint32Array(this.uniformData)
  }

  protected drawRegion(
    block: RenderBlock,
    clip: BlockClipResult,
    _region: ScoreRegionData,
    state: ScoreRenderState,
  ) {
    // fills the hp-split genomic->clip transform (and negates it on reversal)
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.zero] = 0
    this.uniformF32[U.canvasWidth] = state.canvasWidth
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    this.uniformU32[UU.color] = cssColorToABGR(state.color)
    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS, block.displayedRegionIndex)
  }
}
