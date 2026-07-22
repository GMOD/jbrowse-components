import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'

import type { ScoreRegionData } from '../../ScoreRPC/rpcTypes.ts'
import type { ScoreRenderState } from './scoreTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const PASS = 'score'
const U = shader.UNIFORM_OFFSET_F32
const UU = shader.UNIFORM_OFFSET_U32

// Exported so the factory can hand the pass list to the HAL. Six vertices per
// instance = two triangles, so the boxes need a triangle-list topology.
export const SCORE_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS, mod: shader, topology: 'triangle-list' }),
]

export class GpuScoreRenderer extends GpuPerRegionRenderingBackend<
  ScoreRegionData,
  ScoreRenderState
> {
  private uniformF32: Float32Array
  private uniformU32: Uint32Array

  constructor(hal: GpuHal) {
    // the base allocates the reusable this.uniformData scratch buffer
    super(hal, shader.UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformU32 = new Uint32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: ScoreRegionData) {
    if (data.numFeatures === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      return
    }
    // the generated packInstances interleaves the parallel arrays into the
    // GL_ATTRIBUTES layout — no manual DataView offsets
    const buf = shader.packInstances(
      { startBp: data.starts, endBp: data.ends, score: data.scores },
      data.numFeatures,
    )
    this.hal.uploadBuffer(displayedRegionIndex, PASS, buf, data.numFeatures)
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
