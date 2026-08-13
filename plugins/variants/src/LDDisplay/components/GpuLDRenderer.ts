import { GpuGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as ldGenomicShader from './shaders/ldGenomic.generated.ts'
import * as ldUniformShader from './shaders/ldUniform.generated.ts'

import type {
  LDRenderState,
  LDRenderingBackend,
  LDUploadData,
} from './ldRenderingBackendTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const PASS_GENOMIC = 'genomic'
const REGION_KEY = 0

const F_F32 = ldGenomicShader.INSTANCE_OFFSET_F32
const STRIDE = ldGenomicShader.INSTANCE_STRIDE_WORDS
const STRIDE_BYTES = ldGenomicShader.INSTANCE_STRIDE_BYTES

// Both shader variants share an identical uniform block (ldUniforms.slang
// module) — either module's offsets are authoritative.
const UNIFORMS_SIZE_BYTES = ldGenomicShader.UNIFORMS_SIZE_BYTES
const U = ldGenomicShader.UNIFORM_OFFSET_F32
const UU = ldGenomicShader.UNIFORM_OFFSET_U32

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
    f32[off + F_F32.position] = data.positions[i * 2]!
    f32[off + F_F32.position + 1] = data.positions[i * 2 + 1]!
    f32[off + F_F32.cellSize] = data.cellSizes[i * 2]!
    f32[off + F_F32.cellSize + 1] = data.cellSizes[i * 2 + 1]!
    f32[off + F_F32.ldValue] = data.ldValues[i]!
  }
  return buf
}

export const LD_PASSES: PipelineDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: ldUniformShader,
  }),
  slangPass({
    id: PASS_GENOMIC,
    mod: ldGenomicShader,
  }),
]

export { UNIFORMS_SIZE_BYTES as LD_UNIFORM_BYTE_SIZE }

export class GpuLDRenderer
  extends GpuGlobalRenderingBackend<LDUploadData, LDRenderState>
  implements LDRenderingBackend
{
  private uniformF32: Float32Array
  private uniformU32: Uint32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
    this.uniformU32 = new Uint32Array(this.uniformData)
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
      // No floor beyond the empty check above: numCells is the triangular count
      // n*(n-1)/2, so a single cell is a real two-SNP matrix that the Canvas2D
      // and SVG paths both paint. Dropping it here (an `n < 2` guard that
      // survived the count changing shape) made the GPU backend the only one
      // that showed nothing.
      this.hal.uploadBuffer(REGION_KEY, PASS_MAIN, data.ldValues, data.numCells)
    }
  }

  uploadColorRamp(colors: Uint8Array) {
    this.hal.uploadTexture(PASS_MAIN, colors, 256, 1)
    this.hal.uploadTexture(PASS_GENOMIC, colors, 256, 1)
  }

  render(data: LDUploadData | null, state: LDRenderState) {
    const { canvasWidth, canvasHeight } = state

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const hasMain = this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0
    const hasGenomic = this.hal.getBufferCount(REGION_KEY, PASS_GENOMIC) > 0

    // signedLD/uniformW come from the payload the buffers were packed from, so
    // an uploaded buffer with no current data draws nothing rather than coloring
    // by a stand-in convention.
    if (data && (hasMain || hasGenomic)) {
      this.uniformF32[U.canvasSize] = canvasWidth
      this.uniformF32[U.canvasSize + 1] = canvasHeight
      this.uniformF32[U.yScalar] = state.yScalar
      this.uniformF32[U.viewScale] = state.viewScale
      this.uniformF32[U.viewOffsetX] = state.viewOffsetX
      this.uniformU32[UU.signedLd] = data.signedLD ? 1 : 0
      this.uniformF32[U.uniformW] = data.uniformW

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
}
