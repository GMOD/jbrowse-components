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
const F = hicShader.FIELD_OFFSET_F32
const STRIDE = hicShader.INSTANCE_STRIDE_F32
const STRIDE_BYTES = hicShader.INSTANCE_STRIDE_BYTES

export const HIC_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: hicShader,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

export {
  STRIDE as HIC_INSTANCE_STRIDE_F32,
  UNIFORMS_SIZE_BYTES as HIC_UNIFORM_BYTE_SIZE,
}

function interleaveHicInstances(data: HicUploadData) {
  const count = data.numContacts
  const buf = new ArrayBuffer(count * STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * STRIDE
    f32[off + F.position] = data.positions[i * 2]!
    f32[off + F.position + 1] = data.positions[i * 2 + 1]!
    f32[off + F.count] = data.counts[i]!
  }
  return buf
}

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
    const buf = interleaveHicInstances(data)
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numContacts)
  }

  uploadColorRamp(colors: Uint8Array) {
    this.hal.uploadTexture(PASS_MAIN, colors, 256, 1)
  }

  render(_data: HicUploadData | null, state: HicRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    if (this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0) {
      this.uniformF32[U.canvasSize] = canvasWidth
      this.uniformF32[U.canvasSize + 1] = canvasHeight
      this.uniformF32[U.binWidth] = state.binWidth
      this.uniformF32[U.yScalar] = state.yScalar
      this.uniformF32[U.colorMaxScore] = state.colorMaxScore
      this.uniformF32[U.viewScale] = state.viewScale
      this.uniformF32[U.viewOffsetX] = state.viewOffsetX
      this.uniformU32[U.useLogScale] = state.useLogScale ? 1 : 0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }
}
