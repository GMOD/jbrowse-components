import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { GpuGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as variantMatrixShader from './shaders/variantMatrix.generated.ts'
import { interleaveMatrixInstances } from './variantMatrixShaders.ts'

import type {
  MatrixRenderState,
  VariantMatrixUploadData,
} from './variantMatrixRenderingBackendTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const UNIFORMS_SIZE_BYTES = variantMatrixShader.UNIFORMS_SIZE_BYTES

export const VARIANT_MATRIX_PASSES: PipelineDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: variantMatrixShader,
  }),
]

export { UNIFORMS_SIZE_BYTES as VARIANT_MATRIX_UNIFORM_BYTE_SIZE }

export class GpuVariantMatrixRenderer extends GpuGlobalRenderingBackend<
  VariantMatrixUploadData,
  MatrixRenderState
> {
  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
  }

  upload(_key: 'data', data: VariantMatrixUploadData) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }
    const buf = interleaveMatrixInstances(data)
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numCells)
  }

  // The resize and the beginFrame/endFrame around this belong to
  // `GpuGlobalRenderingBackend`.
  protected draw(data: VariantMatrixUploadData, state: MatrixRenderState) {
    const { numFeatures } = data
    if (
      numFeatures === 0 ||
      this.hal.getBufferCount(REGION_KEY, PASS_MAIN) === 0
    ) {
      return false
    }
    // Whole-block packer rather than offset pokes: every field is set once a
    // frame, and the scratch buffer outlives the frame, so a poke left out would
    // silently reuse the last frame's value where a missing key here is a type
    // error.
    variantMatrixShader.writeUniforms(this.uniformData, {
      numFeatures,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      rowHeight: state.rowHeight,
      scrollTop: state.scrollTop,
      // Must be `getDpr()`, not a bare `devicePixelRatio` read: the shader
      // rebuilds the backing-store width as `canvasWidth * devicePixelRatio` to
      // snap column edges to physical pixels, so this has to be the same ratio
      // `hal.resize` just sized the backing store with — including its cap.
      devicePixelRatio: getDpr(),
    })

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_MAIN, REGION_KEY)
    return true
  }
}
