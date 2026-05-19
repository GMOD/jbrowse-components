import { bpRangeXTuple, clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import {
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/maf.generated.ts'

import type {
  MafBackend,
  MafGPURenderState,
  MafRenderBlock,
  MafUploadPayload,
} from './mafBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'

export const MAF_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_RECT, mod: mafShader, topology: 'triangle-list' }),
]

const U = UNIFORM_OFFSET_F32

export class GpuMafRenderer implements MafBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private regionCount = new Map<number, number>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(displayedRegionIndex: number, data: MafUploadPayload) {
    const { instanceBuffer, instanceCount } = data
    if (instanceCount === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      this.regionCount.delete(displayedRegionIndex)
    } else {
      // Buffer is pre-encoded on the main thread by the per-region encode autorun.
      // The shader unpacks absolute genomic coords + rowIndex + color.
      this.hal.uploadBuffer(
        displayedRegionIndex,
        PASS_RECT,
        instanceBuffer,
        instanceCount,
      )
      this.regionCount.set(displayedRegionIndex, instanceCount)
    }
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionCount, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  renderBlocks(blocks: MafRenderBlock[], state: MafGPURenderState) {
    const { canvasWidth, canvasHeight, rowHeight, rowProportion } = state
    const dpr = getDpr()

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      const bufCount = this.hal.getBufferCount(
        block.displayedRegionIndex,
        PASS_RECT,
      )
      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (bufCount === 0) {
        continue
      }
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
      this.uniformF32[U.reversed] = block.reversed ? 1 : 0
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

  dispose() {
    this.regionCount.clear()
    this.hal.dispose()
  }
}
