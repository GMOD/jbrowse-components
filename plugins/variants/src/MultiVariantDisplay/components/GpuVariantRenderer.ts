import { clipBlock } from '@jbrowse/core/gpu/blockClipUtils'

import { FRAGMENT_SHADER, VERTEX_SHADER } from './variantGlslShaders.ts'
import { INSTANCE_STRIDE, interleaveVariantInstances, variantShader } from './variantShaders.ts'

import type { VariantBackend, VariantRenderBlock } from './variantBackendTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_MAIN = 'main'
const INSTANCE_BYTES = INSTANCE_STRIDE * 4
const UNIFORM_BYTE_SIZE = 48

export const VARIANT_PASSES: PassDescriptor[] = [
  {
    id: PASS_MAIN,
    wgslSource: variantShader,
    glslVertex: VERTEX_SHADER,
    glslFragment: FRAGMENT_SHADER,
    instanceStride: INSTANCE_BYTES,
    verticesPerInstance: 6,
    blend: true,
    blendState: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
    glAttributes: [
      { name: 'a_start_end', components: 2, type: 'uint', offsetBytes: 0, integer: true },
      { name: 'a_row_index', components: 1, type: 'uint', offsetBytes: 8, integer: true },
      { name: 'a_shape_type', components: 1, type: 'uint', offsetBytes: 12, integer: true },
      { name: 'a_color', components: 4, type: 'float', offsetBytes: 16, integer: false },
    ],
  },
]

export { UNIFORM_BYTE_SIZE as VARIANT_UNIFORM_BYTE_SIZE }

export class GpuVariantRenderer implements VariantBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionStarts = new Map<number, number>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(
    regionNumber: number,
    data: {
      regionStart: number
      cellPositions: Uint32Array
      cellRowIndices: Uint32Array
      cellColors: Uint8Array
      cellShapeTypes: Uint8Array
      numCells: number
    },
  ) {
    if (data.numCells === 0) {
      this.hal.deleteRegion(regionNumber)
      this.regionStarts.delete(regionNumber)
      return
    }

    const buf = interleaveVariantInstances(data)
    this.hal.uploadBuffer(regionNumber, PASS_MAIN, buf, data.numCells)
    this.regionStarts.set(regionNumber, data.regionStart)
  }

  pruneStaleRegions(activeRegionNumbers: number[]) {
    const active = new Set(activeRegionNumbers)
    for (const regionNumber of this.regionStarts.keys()) {
      if (!active.has(regionNumber)) {
        this.hal.deleteRegion(regionNumber)
        this.regionStarts.delete(regionNumber)
      }
    }
  }

  renderBlocks(
    blocks: VariantRenderBlock[],
    state: {
      canvasWidth: number
      canvasHeight: number
      rowHeight: number
      scrollTop: number
    },
  ) {
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      if (this.hal.getBufferCount(block.regionNumber, PASS_MAIN) === 0) {
        continue
      }
      const regionStart = this.regionStarts.get(block.regionNumber)
      if (regionStart === undefined) {
        continue
      }

      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      this.uniformF32[0] = clip.bpStartHi
      this.uniformF32[1] = clip.bpStartLo
      this.uniformF32[2] = clip.clippedLengthBp
      this.uniformU32[3] = Math.floor(regionStart)
      this.uniformF32[4] = canvasHeight
      this.uniformF32[5] = clip.scissorW
      this.uniformF32[6] = state.rowHeight
      this.uniformF32[7] = state.scrollTop
      // uniformF32[8] = 0 (zero) — already 0.0 from ArrayBuffer initialization

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(PASS_MAIN, block.regionNumber)
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
