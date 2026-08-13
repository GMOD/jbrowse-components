import { writeBpRangeUniforms } from '@jbrowse/render-core/blockClipUtils'
import { instancePass } from '@jbrowse/render-core/instancePass'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import * as variantShader from './shaders/variant.generated.ts'
import { interleaveVariantInstances } from './variantShaders.ts'

import type {
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const UNIFORMS_SIZE_BYTES = variantShader.UNIFORMS_SIZE_BYTES
const U = variantShader.UNIFORM_OFFSET_F32

export const VARIANT_PASSES = [
  instancePass({
    id: PASS_MAIN,
    mod: variantShader,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    pack: interleaveVariantInstances,
  }),
]

export { UNIFORMS_SIZE_BYTES as VARIANT_UNIFORM_BYTE_SIZE }

export class GpuVariantRenderer extends GpuPerRegionRenderingBackend<
  VariantUploadData,
  VariantRenderState
> {
  private uniformF32: Float32Array
  protected regionPasses = VARIANT_PASSES

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
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
