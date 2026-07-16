import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as variantShader from './shaders/variant.generated.ts'
import { interleaveVariantInstances } from './variantShaders.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const UNIFORMS_SIZE_BYTES = variantShader.UNIFORMS_SIZE_BYTES
const U = variantShader.UNIFORM_OFFSET_F32

export const VARIANT_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: variantShader,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

export { UNIFORMS_SIZE_BYTES as VARIANT_UNIFORM_BYTE_SIZE }

export class GpuVariantRenderer extends GpuPerRegionRenderingBackend<
  VariantUploadData,
  VariantRenderState
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: VariantUploadData) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      return
    }
    const buf = interleaveVariantInstances(data)
    this.hal.uploadBuffer(displayedRegionIndex, PASS_MAIN, buf, data.numCells)
  }

  protected drawRegion(
    block: VariantRenderBlock,
    clip: BlockClipResult,
    _region: VariantUploadData,
    state: VariantRenderState,
  ) {
    writeBpRangeUniforms(this.uniformF32, U.bpRangeX, clip, block.reversed)
    this.uniformF32[U.canvasHeight] = state.canvasHeight
    this.uniformF32[U.canvasWidth] = clip.scissorW
    this.uniformF32[U.rowHeight] = state.rowHeight
    this.uniformF32[U.scrollTop] = state.scrollTop
    // uniformF32[U.zero] = 0 — already 0.0 from ArrayBuffer initialization

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_MAIN, block.displayedRegionIndex)
  }
}
