import {
  clipBlock,
  writeBpRangeUniforms,
} from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

import * as variantShader from './shaders/variant.generated.ts'
import { interleaveVariantInstances } from './variantShaders.ts'

import type {
  VariantBackend,
  VariantRenderBlock,
  VariantRenderState,
  VariantUploadData,
} from './variantBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const UNIFORMS_SIZE_BYTES = variantShader.UNIFORMS_SIZE_BYTES
const U = variantShader.UNIFORM_OFFSET_F32

export const VARIANT_PASSES: PassDescriptor[] = [
  slangPass({
    id: PASS_MAIN,
    mod: variantShader,
    verticesPerInstance: 6,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
  }),
]

export { UNIFORMS_SIZE_BYTES as VARIANT_UNIFORM_BYTE_SIZE }

export class GpuVariantRenderer implements VariantBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionStarts = new Map<number, number>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(displayedRegionIndex: number, data: VariantUploadData) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(displayedRegionIndex)
      this.regionStarts.delete(displayedRegionIndex)
      return
    }

    const buf = interleaveVariantInstances(data)
    this.hal.uploadBuffer(displayedRegionIndex, PASS_MAIN, buf, data.numCells)
    this.regionStarts.set(displayedRegionIndex, data.regionStart)
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionStarts, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  renderBlocks(blocks: VariantRenderBlock[], state: VariantRenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      if (
        this.hal.getBufferCount(block.displayedRegionIndex, PASS_MAIN) === 0
      ) {
        continue
      }
      const regionStart = this.regionStarts.get(block.displayedRegionIndex)
      if (regionStart === undefined) {
        continue
      }

      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      writeBpRangeUniforms(this.uniformF32, clip, block.reversed)
      this.uniformU32[U.regionStart] = Math.floor(regionStart)
      this.uniformF32[U.canvasHeight] = canvasHeight
      this.uniformF32[U.canvasWidth] = clip.scissorW
      this.uniformF32[U.rowHeight] = state.rowHeight
      this.uniformF32[U.scrollTop] = state.scrollTop
      // uniformF32[U.zero] = 0 — already 0.0 from ArrayBuffer initialization

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, block.displayedRegionIndex)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  dispose() {
    this.regionStarts.clear()
    this.hal.dispose()
  }
}
