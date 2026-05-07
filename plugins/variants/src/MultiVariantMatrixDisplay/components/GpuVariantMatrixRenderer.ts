import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as variantMatrixShader from './shaders/variantMatrix.generated.ts'
import { interleaveMatrixInstances } from './variantMatrixShaders.ts'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
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

export class GpuVariantMatrixRenderer implements VariantMatrixBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private numFeatures = 0

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadCellData(data: VariantMatrixUploadData) {
    this.numFeatures = data.numFeatures
    if (data.numCells === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }

    const buf = interleaveMatrixInstances(data)
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numCells)
  }

  render(state: MatrixRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    if (
      this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0 &&
      this.numFeatures > 0
    ) {
      this.uniformF32[U.numFeatures] = this.numFeatures
      this.uniformF32[U.canvasWidth] = canvasWidth
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformF32[U.rowHeight] = state.rowHeight
      this.uniformF32[U.scrollTop] = state.scrollTop

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
