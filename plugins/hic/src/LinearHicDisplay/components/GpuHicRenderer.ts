import { GpuGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as hicShader from './shaders/hic.generated.ts'

import type {
  HicRenderState,
  HicRenderingBackend,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const UNIFORMS_SIZE_BYTES = hicShader.UNIFORMS_SIZE_BYTES
const U = hicShader.UNIFORM_OFFSET_F32
const UU = hicShader.UNIFORM_OFFSET_U32

export const HIC_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: hicShader,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

export { UNIFORMS_SIZE_BYTES as HIC_UNIFORM_BYTE_SIZE }

export class GpuHicRenderer
  extends GpuGlobalRenderingBackend<HicUploadData, HicRenderState>
  implements HicRenderingBackend
{
  private uniformF32: Float32Array
  private uniformU32: Uint32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformU32 = new Uint32Array(this.uniformData)
  }

  uploadData(data: HicUploadData) {
    if (data.numContacts === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }
    // `positions` is already the shader's `float2 position` field and `counts`
    // its `float count`, so the generated SoA packer applies directly — no
    // hand-rolled interleave to keep in step with the .slang layout.
    const buf = hicShader.packInstances(
      { position: data.positions, count: data.counts },
      data.numContacts,
    )
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numContacts)
  }

  uploadColorRamp(colors: Uint8Array) {
    this.hal.uploadTexture(PASS_MAIN, colors, 256, 1)
  }

  render(data: HicUploadData | null, state: HicRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    // binWidth comes from the payload the buffers were packed from, so an
    // uploaded buffer with no current data draws nothing rather than scaling
    // bins by a stand-in.
    if (data && this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0) {
      this.uniformF32[U.canvasSize] = canvasWidth
      this.uniformF32[U.canvasSize + 1] = canvasHeight
      this.uniformF32[U.binWidth] = data.binWidth
      this.uniformF32[U.yScalar] = state.yScalar
      this.uniformF32[U.colorMaxScore] = state.colorMaxScore
      this.uniformF32[U.viewScale] = state.viewScale
      this.uniformF32[U.viewOffsetX] = state.viewOffsetX
      this.uniformU32[UU.useLogScale] = state.useLogScale ? 1 : 0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }
}
