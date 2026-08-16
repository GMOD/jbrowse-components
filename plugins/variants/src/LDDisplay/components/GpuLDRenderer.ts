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

// Both shader variants share an identical uniform block (ldUniforms.slang
// module) — either module's offsets are authoritative.
const UNIFORMS_SIZE_BYTES = ldGenomicShader.UNIFORMS_SIZE_BYTES

// The generated packer, not a loop of our own: `ldGenomic`'s instance struct is
// exactly `{position: float2, cellSize: float2, ldValue: float}`, and
// `packInstances` reads a vecN field as N consecutive values per instance —
// which is the shape `positions` and `cellSizes` already have. The hand-written
// interleave this replaces was a field-for-field transcription of it.
//
// Unlike the append-at-a-time `InstanceWriter`, this costs nothing: it is one
// call containing the whole loop, not a call per instance.
export function interleaveLDInstances(data: {
  positions: Float32Array
  cellSizes: Float32Array
  ldValues: Float32Array
  numCells: number
}) {
  return ldGenomicShader.packInstances(
    {
      position: data.positions,
      cellSize: data.cellSizes,
      ldValue: data.ldValues,
    },
    data.numCells,
  )
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
  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
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

  // signedLD/uniformW come from the payload the buffers were packed from, so an
  // uploaded buffer with no current data draws nothing rather than coloring by
  // a stand-in convention. The resize and the beginFrame/endFrame around this
  // belong to `GpuGlobalRenderingBackend`.
  protected draw(data: LDUploadData, state: LDRenderState) {
    const hasMain = this.hal.getBufferCount(REGION_KEY, PASS_MAIN) > 0
    const hasGenomic = this.hal.getBufferCount(REGION_KEY, PASS_GENOMIC) > 0
    if (!hasMain && !hasGenomic) {
      return false
    }
    // Either variant's offsets are authoritative — both draw the one
    // `ldUniforms.slang` block — so the packer is `ldGenomic`'s the same way the
    // size above is. Whole-block rather than offset pokes: every field is set
    // once a frame, and the scratch buffer outlives the frame, so a poke left
    // out would silently reuse the last frame's value where a missing key here
    // is a type error.
    ldGenomicShader.writeUniforms(this.uniformData, {
      canvasSize: [state.canvasWidth, state.canvasHeight],
      yScalar: state.yScalar,
      viewScale: state.viewScale,
      viewOffsetX: state.viewOffsetX,
      signedLd: data.signedLD ? 1 : 0,
      uniformW: data.uniformW,
    })

    this.hal.writeUniforms(this.uniformData)
    if (hasMain) {
      this.hal.drawPass(PASS_MAIN, REGION_KEY)
    }
    if (hasGenomic) {
      this.hal.drawPass(PASS_GENOMIC, REGION_KEY)
    }
    return true
  }
}
