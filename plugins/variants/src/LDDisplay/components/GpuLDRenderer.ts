import {
  FRAGMENT_SHADER,
  GENOMIC_VERTEX_SHADER,
  UNIFORM_VERTEX_SHADER,
} from './ldGlslShaders.ts'
import {
  GENOMIC_INSTANCE_STRIDE,
  UNIFORM_INSTANCE_STRIDE,
  interleaveLDInstances,
  ldGenomicShader,
  ldUniformShader,
} from './ldShaders.ts'

import type {
  LDBackend,
  LDRenderState,
  LDUploadData,
} from './ldBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const PASS_GENOMIC = 'genomic'
const UNIFORM_BYTE_SIZE = 32
const REGION_KEY = 0

const SHARED_TEXTURES = [
  {
    textureBinding: 2,
    samplerBinding: 3,
    glTextureUnit: 0,
    glUniformName: 'u_colorRamp',
    filter: 'linear' as const,
  },
]

export const LD_PASSES: PassDescriptor[] = [
  {
    id: PASS_MAIN,
    wgslSource: ldUniformShader,
    glslVertex: UNIFORM_VERTEX_SHADER,
    glslFragment: FRAGMENT_SHADER,
    instanceStride: UNIFORM_INSTANCE_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    glAttributes: [
      {
        name: 'a_ldValue',
        components: 1,
        type: 'float',
        offsetBytes: 0,
        integer: false,
      },
    ],
    textures: SHARED_TEXTURES,
  },
  {
    id: PASS_GENOMIC,
    wgslSource: ldGenomicShader,
    glslVertex: GENOMIC_VERTEX_SHADER,
    glslFragment: FRAGMENT_SHADER,
    instanceStride: GENOMIC_INSTANCE_STRIDE * 4,
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
    textures: SHARED_TEXTURES,
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

  uploadData(data: LDUploadData) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(REGION_KEY)
      return
    }

    if (data.positions && data.cellSizes) {
      this.hal.deleteBuffer(REGION_KEY, PASS_MAIN)
      const buf = interleaveLDInstances({
        positions: data.positions,
        cellSizes: data.cellSizes,
        ldValues: data.ldValues,
        numCells: data.numCells,
      })
      this.hal.uploadBuffer(REGION_KEY, PASS_GENOMIC, buf, data.numCells)
    } else {
      this.hal.deleteBuffer(REGION_KEY, PASS_GENOMIC)
      this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, data.ldValues, data.numCells)
    }
  }

  uploadColorRamp(colors: Uint8Array) {
    this.hal.uploadTexture(PASS_MAIN, colors, 256, 1)
    this.hal.uploadTexture(PASS_GENOMIC, colors, 256, 1)
  }

  render(state: LDRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const hasMain = this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0
    const hasGenomic = this.hal.getBufferCount(REGION_KEY, PASS_GENOMIC) > 0

    if (hasMain || hasGenomic) {
      this.uniformF32[0] = canvasWidth
      this.uniformF32[1] = canvasHeight
      this.uniformF32[2] = state.yScalar
      this.uniformF32[3] = state.viewScale
      this.uniformF32[4] = state.viewOffsetX
      this.uniformU32[5] = state.signedLD ? 1 : 0
      this.uniformF32[6] = state.uniformW

      this.hal.writeUniforms(this.uniformData)
      if (hasMain) {
        this.hal.drawPass(PASS_MAIN, REGION_KEY)
      }
      if (hasGenomic) {
        this.hal.drawPass(PASS_GENOMIC, REGION_KEY)
      }
    }

    this.hal.endFrame()
  }

  dispose() {
    this.hal.dispose()
  }
}
