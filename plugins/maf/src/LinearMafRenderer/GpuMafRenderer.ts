import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/maf.iface.generated.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

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
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    // Device px (not CSS) on purpose: viewportWidth feeds only the shader's
    // `minClipW = 2/viewportWidth` X-axis floor, giving a crisp 1-device-px
    // minimum cell width, matching GpuMultiRowRenderer. (Wiggle uses CSS px for
    // a chunkier 3-CSS-px bar floor.) It never interacts with canvasHeight.
    this.uniformF32[U.viewportWidth] = clip.pxW
    this.uniformF32[U.zero] = 0
    this.uniformF32[U.rowHeight] = state.rowHeight
    this.uniformF32[U.rowProportion] = state.rowProportion

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  }
}
