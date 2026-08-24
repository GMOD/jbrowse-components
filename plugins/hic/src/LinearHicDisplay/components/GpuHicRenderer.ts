import { GpuGlobalRenderingBackend } from '@jbrowse/render-core/globalRenderingBackend'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as hicShader from './shaders/hic.generated.ts'

import type {
  HicRenderState,
  HicCellKey,
  HicRenderingBackend,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'

const PASS_MAIN = 'main'
const REGION_KEY = 0
const UNIFORMS_SIZE_BYTES = hicShader.UNIFORMS_SIZE_BYTES

export const HIC_PASSES: PipelineDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: hicShader,
  }),
]

export { UNIFORMS_SIZE_BYTES as HIC_UNIFORM_BYTE_SIZE }

export class GpuHicRenderer
  extends GpuGlobalRenderingBackend<
    HicUploadData,
    HicRenderState,
    HicCellKey,
    HicUploadData | Uint8Array
  >
  implements HicRenderingBackend
{
  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
  }

  upload(_key: HicCellKey, cell: HicUploadData | Uint8Array) {
    if (cell instanceof Uint8Array) {
      this.uploadColorRamp(cell)
    } else {
      this.uploadMatrix(cell)
    }
  }

  private uploadMatrix(data: HicUploadData) {
    // Zero-copy: the worker already packed this in the shader's own instance
    // layout (`HicDataResult.instances`), so there is nothing to interleave —
    // the buffer that arrived over the RPC boundary is the vertex buffer. This
    // used to call the generated `packInstances` over parallel
    // positions/counts arrays, which cost a full O(numContacts) rebuild and a
    // 12-byte-per-contact allocation on the main thread on every fetch. No
    // empty-upload guard: an empty pack IS the release (the HAL deletes the
    // prior buffer before looking at the count).
    this.hal.uploadBuffer(
      REGION_KEY,
      PASS_MAIN,
      data.instances,
      data.numContacts,
    )
  }

  uploadColorRamp(colors: Uint8Array) {
    this.hal.uploadTexture(PASS_MAIN, colors, 256, 1)
  }

  // binWidth comes from the payload the buffers were packed from, so an
  // uploaded buffer with no current data draws nothing rather than scaling bins
  // by a stand-in. The resize and the beginFrame/endFrame around this belong to
  // `GpuGlobalRenderingBackend`.
  protected draw(data: HicUploadData, state: HicRenderState) {
    if (this.hal.getBufferCount(REGION_KEY, PASS_MAIN) === 0) {
      return false
    }
    // The generated whole-block packer, not offset pokes: this writes every
    // field of the block once a frame, which is the case render-core's CLAUDE.md
    // gives to the packer. It also makes the set *total* — the scratch buffer
    // outlives the frame, so a poke left out silently reuses the last frame's
    // value, where a missing key here is a type error.
    hicShader.writeUniforms(this.uniformData, {
      canvasSize: [state.canvasWidth, state.canvasHeight],
      binWidth: data.binWidth,
      yScalar: state.yScalar,
      colorMaxScore: state.colorMaxScore,
      viewScale: state.viewScale,
      viewOffsetX: state.viewOffsetX,
      useLogScale: state.useLogScale ? 1 : 0,
    })

    this.hal.writeUniforms(this.uniformData)
    this.hal.drawPass(PASS_MAIN, REGION_KEY)
    return true
  }
}
