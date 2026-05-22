import { GpuMonolithicBackend } from '@jbrowse/core/gpu/monolithicBackend'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as variantMatrixShader from './shaders/variantMatrix.generated.ts'
import { interleaveMatrixInstances } from './variantMatrixShaders.ts'

import type {
  MatrixRenderState,
  VariantMatrixUploadData,
} from './variantMatrixBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const UNIFORMS_SIZE_BYTES = variantMatrixShader.UNIFORMS_SIZE_BYTES
const U = variantMatrixShader.UNIFORM_OFFSET_F32

export const VARIANT_MATRIX_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: variantMatrixShader,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

export { UNIFORMS_SIZE_BYTES as VARIANT_MATRIX_UNIFORM_BYTE_SIZE }

export class GpuVariantMatrixRenderer extends GpuMonolithicBackend<
  VariantMatrixUploadData,
  MatrixRenderState
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  uploadData(data: VariantMatrixUploadData) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }
    const buf = interleaveMatrixInstances(data)
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numCells)
  }

  render(data: VariantMatrixUploadData | null, state: MatrixRenderState) {
    const { canvasWidth, canvasHeight } = state
    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const numFeatures = data?.numFeatures ?? 0
    if (numFeatures > 0 && this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0) {
      this.uniformF32[U.numFeatures] = numFeatures
      this.uniformF32[U.canvasWidth] = canvasWidth
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformF32[U.rowHeight] = state.rowHeight
      this.uniformF32[U.scrollTop] = state.scrollTop

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }
}
