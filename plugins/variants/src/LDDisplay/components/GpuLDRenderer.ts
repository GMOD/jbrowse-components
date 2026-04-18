import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as ldGenomicShader from './shaders/ldGenomic.generated.ts'
import * as ldUniformShader from './shaders/ldUniform.generated.ts'

const F = ldGenomicShader.FIELD_OFFSET_F32
const STRIDE = ldGenomicShader.INSTANCE_STRIDE_F32
const STRIDE_BYTES = ldGenomicShader.INSTANCE_STRIDE_BYTES

function interleaveLDInstances(data: {
  positions: Float32Array
  cellSizes: Float32Array
  ldValues: Float32Array
  numCells: number
}) {
  const count = data.numCells
  const buf = new ArrayBuffer(count * STRIDE_BYTES)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const off = i * STRIDE
    f32[off + F.position] = data.positions[i * 2]!
    f32[off + F.position + 1] = data.positions[i * 2 + 1]!
    f32[off + F.cellSize] = data.cellSizes[i * 2]!
    f32[off + F.cellSize + 1] = data.cellSizes[i * 2 + 1]!
    f32[off + F.ldValue] = data.ldValues[i]!
  }
  return buf
}

import type {
  LDBackend,
  LDRenderState,
  LDUploadData,
} from './ldBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const PASS_GENOMIC = 'genomic'
const REGION_KEY = 0

// Both shader variants share an identical uniform block (ldUniforms.slang
// module) — either module's offsets are authoritative.
const UNIFORMS_SIZE_BYTES = ldGenomicShader.UNIFORMS_SIZE_BYTES
const U = ldGenomicShader.UNIFORM_OFFSET_F32

const BLEND_PREMUL = {
  srcFactor: 'one',
  dstFactor: 'one-minus-src-alpha',
} as const

export const LD_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: ldUniformShader,
    verticesPerInstance: 6,
    blendState: BLEND_PREMUL,
  }),
  slangPass({
    id: PASS_GENOMIC,
    mod: ldGenomicShader,
    verticesPerInstance: 6,
    blendState: BLEND_PREMUL,
  }),
]

export { UNIFORMS_SIZE_BYTES as LD_UNIFORM_BYTE_SIZE }

export class GpuLDRenderer implements LDBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
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
      // numCells = n*n; need at least 2 variants for a meaningful LD display
      const n = Math.round(Math.sqrt(data.numCells))
      if (n < 2) {
        this.hal.deleteRegion(REGION_KEY)
        return
      }
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
      this.uniformF32[U.canvasSize] = canvasWidth
      this.uniformF32[U.canvasSize + 1] = canvasHeight
      this.uniformF32[U.yScalar] = state.yScalar
      this.uniformF32[U.viewScale] = state.viewScale
      this.uniformF32[U.viewOffsetX] = state.viewOffsetX
      this.uniformU32[U.signedLd] = state.signedLD ? 1 : 0
      this.uniformF32[U.uniformW] = state.uniformW

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
