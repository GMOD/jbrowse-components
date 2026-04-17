import { slangPass } from '@jbrowse/core/gpu/slangPass'

import { interleaveHicInstances } from './hicShaders.ts'
import * as hicShader from './shaders/hic.generated.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const UNIFORMS_SIZE_BYTES = hicShader.UNIFORMS_SIZE_BYTES
const U = hicShader.UNIFORM_OFFSET_F32

export const HIC_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: hicShader,
    verticesPerInstance: 6,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

export { UNIFORMS_SIZE_BYTES as HIC_UNIFORM_BYTE_SIZE }

export class GpuHicRenderer implements HicBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }) {
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

  render(state: HicRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    if (this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0) {
      this.uniformF32[U.canvasSize] = canvasWidth
      this.uniformF32[U.canvasSize + 1] = canvasHeight
      this.uniformF32[U.binWidth] = state.binWidth
      this.uniformF32[U.yScalar] = state.yScalar
      this.uniformF32[U.maxScore] = state.maxScore
      this.uniformF32[U.viewScale] = state.viewScale
      this.uniformF32[U.viewOffsetX] = state.viewOffsetX
      this.uniformU32[U.useLogScale] = state.useLogScale ? 1 : 0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
