import { bpRangeXTuple } from '@jbrowse/core/gpu/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/maf.generated.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/core/gpu/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'

export const MAF_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_RECT, mod: mafShader, topology: 'triangle-list' }),
]

const U = UNIFORM_OFFSET_F32

export class GpuMafRenderer extends GpuPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: MafUploadPayload) {
    const { instanceBuffer, instanceCount } = data
    if (instanceCount === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
    } else {
      // Buffer is pre-encoded on the main thread by the per-region encode autorun.
      // The shader unpacks absolute genomic coords + rowIndex + color.
      this.hal.uploadBuffer(
        displayedRegionIndex,
        PASS_RECT,
        instanceBuffer,
        instanceCount,
      )
    }
  }

  protected drawRegion(
    block: MafRenderBlock,
    clip: BlockClipResult,
    _region: MafRegionData,
    state: MafGPURenderState,
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
