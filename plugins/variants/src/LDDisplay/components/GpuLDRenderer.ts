import { FRAGMENT_SHADER, VERTEX_SHADER } from './ldGlslShaders.ts'
import {
  INSTANCE_STRIDE,
  interleaveLDInstances,
  ldShader,
} from './ldShaders.ts'

import type { LDBackend, LDRenderState } from './ldBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const INSTANCE_BYTES = INSTANCE_STRIDE * 4
const UNIFORM_BYTE_SIZE = 32
const REGION_KEY = 0

export const LD_PASSES: PassDescriptor[] = [
  {
    id: PASS_MAIN,
    wgslSource: ldShader,
    glslVertex: VERTEX_SHADER,
    glslFragment: FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTES,
    verticesPerInstance: 6,
    blend: true,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    glAttributes: [
      {
        name: 'a_position',
        components: 2,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
      {
        name: 'a_cellSize',
        components: 2,
        type: 'float',
        offsetBytes: 8,
        integer: false,
      },
      {
        name: 'a_ldValue',
        components: 1,
        type: 'float',
        offsetBytes: 16,
        integer: false,
      },
    ],
    textures: [
      {
        textureBinding: 2,
        samplerBinding: 3,
        glTextureUnit: 0,
        glUniformName: 'u_colorRamp',
        filter: 'linear',
      },
    ],
  },
]

export { UNIFORM_BYTE_SIZE as LD_UNIFORM_BYTE_SIZE }

export class GpuLDRenderer implements LDBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadData(data: {
    positions: Float32Array
    cellSizes: Float32Array
    ldValues: Float32Array
    numCells: number
  }) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }

    const buf = interleaveLDInstances(data)
    this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, buf, data.numCells)
  }

  uploadColorRamp(colors: Uint8Array) {
    this.hal.uploadTexture(PASS_MAIN, colors, 256, 1)
  }

  render(state: LDRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    if (this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0) {
      this.uniformF32[0] = canvasWidth
      this.uniformF32[1] = canvasHeight
      this.uniformF32[2] = state.yScalar
      this.uniformF32[3] = state.viewScale
      this.uniformF32[4] = state.viewOffsetX
      this.uniformU32[5] = state.signedLD ? 1 : 0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
