import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as multiRowShader from './shaders/multiRow.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/multiRow.generated.ts'

import type {
  MultiRowRegionData,
  MultiRowRenderBlock,
  MultiRowRenderState,
  MultiRowUploadPayload,
} from './multiRowRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

const PASS_RECT = 'rect'

export const MULTI_ROW_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_RECT, mod: multiRowShader, topology: 'triangle-list' }),
]

const U = UNIFORM_OFFSET_F32

export class GpuMultiRowRenderer extends GpuPerRegionRenderingBackend<
  MultiRowUploadPayload,
  MultiRowRenderState,
  MultiRowRenderBlock,
  MultiRowRegionData
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: MultiRowUploadPayload) {
    const { instanceBuffer, instanceCount } = data
    if (instanceCount === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
    } else {
      this.hal.uploadBuffer(
        displayedRegionIndex,
        PASS_RECT,
        instanceBuffer,
        instanceCount,
      )
    }
  }

  protected drawRegion(
    block: MultiRowRenderBlock,
    clip: BlockClipResult,
    _region: MultiRowRegionData,
    state: MultiRowRenderState,
  ) {
    const [bpHi, bpLo, bpLen] = bpRangeXTuple(clip, block.reversed)
    this.uniformF32[U.bpRangeX + 0] = bpHi
    this.uniformF32[U.bpRangeX + 1] = bpLo
    this.uniformF32[U.bpRangeX + 2] = bpLen
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    this.uniformF32[U.viewportWidth] = clip.pxW
    this.uniformF32[U.zero] = 0
    this.uniformF32[U.rowHeight] = state.rowHeight
    this.uniformF32[U.rowProportion] = state.rowProportion

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
