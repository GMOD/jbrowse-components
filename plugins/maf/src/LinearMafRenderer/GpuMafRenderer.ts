import { bpRangeXTuple, clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as mafShader from './shaders/maf.generated.ts'
import { UNIFORMS_SIZE_BYTES, UNIFORM_OFFSET_F32 } from './shaders/maf.generated.ts'

import type { MafBackend, MafGPURenderState, MafRegionData, MafRenderBlock } from './mafBackendTypes.ts'
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

  uploadRegion(
    displayedRegionIndex: number,
    instanceBuffer: ArrayBuffer,
    instanceCount: number,
    _regionData: MafRegionData,
  ) {
    if (instanceCount === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      this.regionCount.delete(displayedRegionIndex)
      return
    }
    // Buffer is pre-encoded (absolute genomic coords + rowIndex + color).
    // Upload directly — no re-encoding needed for rowHeight/proportion changes.
    this.hal.uploadBuffer(displayedRegionIndex, PASS_RECT, instanceBuffer, instanceCount)
    this.regionCount.set(displayedRegionIndex, instanceCount)
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

    console.log('[GpuMafRenderer.renderBlocks]', blocks.length, 'blocks, canvas=', canvasWidth, 'x', canvasHeight, 'regionKeys=', [...this.regionCount.keys()])

    for (const block of blocks) {
      const bufCount = this.hal.getBufferCount(block.displayedRegionIndex, PASS_RECT)
      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      console.log(`  block region=${block.displayedRegionIndex} screen=${block.screenStartPx.toFixed(0)}-${block.screenEndPx.toFixed(0)} bufCount=${bufCount} clip=${clip ? `${clip.pxX},${clip.pxW}` : 'null'}`)
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
