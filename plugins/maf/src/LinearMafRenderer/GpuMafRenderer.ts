import { bpRangeXTuple, clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/maf.generated.ts'

import type {
  MafGPURenderState,
  MafRegionData,
  MafRenderBlock,
  MafUploadPayload,
} from './mafRenderingBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'

export const MAF_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_RECT, mod: mafShader, topology: 'triangle-list' }),
]

const U = UNIFORM_OFFSET_F32

export class GpuMafRenderer extends GpuPerRegionRenderingBackend<
  MafUploadPayload,
  MafGPURenderState,
  MafRenderBlock,
  MafRegionData
> {
  private uniformF32: Float32Array

  constructor(hal: GpuHal) {
    super(hal, UNIFORMS_SIZE_BYTES)
    this.uniformF32 = new Float32Array(this.uniformData)
  }

  uploadRegion(displayedRegionIndex: number, data: MafUploadPayload) {
    const { instanceBuffer, instanceCount } = data
    if (instanceCount === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
    } else {
      // Buffer is pre-encoded on the main thread by the per-region encode autorun.
      // The shader unpacks absolute genomic coords + rowIndex + color.
      this.hal.uploadBuffer(
        displayedRegionIndex,
        PASS_RECT,
        instanceBuffer,
        instanceCount,
      )
    }
  }

  renderBlocks(
    blocks: MafRenderBlock[],
    regions: ReadonlyMap<number, MafRegionData>,
    state: MafGPURenderState,
  ) {
    const { canvasWidth, canvasHeight, rowHeight, rowProportion } = state
    const dpr = getDpr()

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      if (!regions.has(block.displayedRegionIndex)) {
        continue
      }
      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      const [bpHi, bpLo, bpLen] = bpRangeXTuple(clip, block.reversed)
      this.uniformF32[U.bpRangeX + 0] = bpHi
      this.uniformF32[U.bpRangeX + 1] = bpLo
      this.uniformF32[U.bpRangeX + 2] = bpLen
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformF32[U.viewportWidth] = clip.pxW
      this.uniformF32[U.zero] = 0
      this.uniformF32[U.rowHeight] = rowHeight
      this.uniformF32[U.rowProportion] = rowProportion

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }
}
