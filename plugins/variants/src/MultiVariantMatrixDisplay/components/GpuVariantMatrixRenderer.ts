import { FRAGMENT_SHADER, VERTEX_SHADER } from './variantMatrixGlslShaders.ts'
import {
  MATRIX_INSTANCE_STRIDE,
  interleaveMatrixInstances,
  variantMatrixShader,
} from './variantMatrixShaders.ts'

import type {
  MatrixRenderState,
  VariantMatrixBackend,
} from './variantMatrixBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const INSTANCE_BYTES = MATRIX_INSTANCE_STRIDE * 4
const UNIFORM_BYTE_SIZE = 32

export const VARIANT_MATRIX_PASSES: PassDescriptor[] = [
  {
    id: PASS_MAIN,
    wgslSource: variantMatrixShader,
    glslVertex: VERTEX_SHADER,
    glslFragment: FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTES,
    verticesPerInstance: 6,
    blend: true,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    glAttributes: [
      {
        name: 'a_feature_index',
        components: 1,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
      {
        name: 'a_row_index',
        components: 1,
        type: 'uint',
        offsetBytes: 4,
        integer: true,
      },
      // offset 8 skips padding (u32x2), then color at offset 16
      {
        name: 'a_color',
        components: 4,
        type: 'float',
        offsetBytes: 16,
        integer: false,
      },
    ],
  },
]

export { UNIFORM_BYTE_SIZE as VARIANT_MATRIX_UNIFORM_BYTE_SIZE }

export class GpuVariantMatrixRenderer implements VariantMatrixBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadCellData(data: {
    cellFeatureIndices: Float32Array
    cellRowIndices: Uint32Array
    cellColors: Uint8Array
    numCells: number
  }) {
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
      state.numFeatures > 0
    ) {
      this.uniformF32[0] = state.numFeatures
      this.uniformF32[1] = canvasWidth
      this.uniformF32[2] = canvasHeight
      this.uniformF32[3] = state.rowHeight
      this.uniformF32[4] = state.scrollTop

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
