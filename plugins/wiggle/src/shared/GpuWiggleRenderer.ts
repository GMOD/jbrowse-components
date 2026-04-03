import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'
import { computeNumRows, interleaveInstances } from './webglUtils.ts'
import {
  WIGGLE_FRAGMENT_SHADER_GLSL,
  WIGGLE_VERTEX_SHADER_GLSL,
} from './wiggleGlslShaders.ts'
import {
  INSTANCE_STRIDE,
  RENDERING_TYPE_LINE,
  UNIFORM_SIZE,
  VERTICES_PER_INSTANCE,
  wiggleShader,
} from './wiggleShader.ts'

import type {
  SourceRenderData,
  WiggleBackend,
  WiggleGPURenderState,
  WiggleRenderBlock,
} from './wiggleBackendTypes.ts'
import type { GlAttributeLayout, GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_FILL = 'fill'
const PASS_LINE = 'line'
const INSTANCE_BYTES = INSTANCE_STRIDE * 4

const WIGGLE_GL_ATTRIBUTES: GlAttributeLayout[] = [
  { name: 'a_start_end', components: 2, type: 'uint', offsetBytes: 0, integer: true },
  { name: 'a_score', components: 1, type: 'float', offsetBytes: 8, integer: false },
  { name: 'a_prev_score', components: 1, type: 'float', offsetBytes: 12, integer: false },
  { name: 'a_row_index', components: 1, type: 'float', offsetBytes: 16, integer: false },
  { name: 'a_color', components: 3, type: 'float', offsetBytes: 20, integer: false },
]

const BASE_PASS = {
  wgslSource: wiggleShader,
  glslVertex: WIGGLE_VERTEX_SHADER_GLSL,
  glslFragment: WIGGLE_FRAGMENT_SHADER_GLSL,
  instanceStride: INSTANCE_BYTES,
  verticesPerInstance: VERTICES_PER_INSTANCE,
  blend: true,
  glAttributes: WIGGLE_GL_ATTRIBUTES,
} as const

export const WIGGLE_PASSES: PassDescriptor[] = [
  { ...BASE_PASS, id: PASS_FILL, topology: 'triangle-list' },
  { ...BASE_PASS, id: PASS_LINE, topology: 'line-list' },
]

export { UNIFORM_SIZE as WIGGLE_UNIFORM_BYTE_SIZE }

interface RegionInfo {
  numRows: number
}

export class GpuWiggleRenderer implements WiggleBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformI32 = new Int32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionInfo = new Map<number, RegionInfo>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(
    regionNumber: number,
    regionStart: number,
    sources: SourceRenderData[],
  ) {
    let totalFeatures = 0
    for (const source of sources) {
      totalFeatures += source.numFeatures
    }

    if (totalFeatures === 0 || sources.length === 0) {
      this.hal.deleteRegion(regionNumber)
      this.regionInfo.delete(regionNumber)
      return
    }

    const buf = interleaveInstances(sources, totalFeatures)

    // Upload once to PASS_FILL; PASS_LINE shares the same buffer via drawPass
    this.hal.uploadBuffer(regionNumber, PASS_FILL, buf, totalFeatures)
    this.hal.setRegionMeta(regionNumber, { regionStart })
    this.regionInfo.set(regionNumber, { numRows: computeNumRows(sources) })
  }

  pruneRegions(activeRegions: number[]) {
    const active = new Set(activeRegions)
    for (const regionNumber of this.regionInfo.keys()) {
      if (!active.has(regionNumber)) {
        this.hal.deleteRegion(regionNumber)
        this.regionInfo.delete(regionNumber)
      }
    }
  }

  renderBlocks(blocks: WiggleRenderBlock[], state: WiggleGPURenderState) {
    const { canvasWidth, canvasHeight } = state
    const dpr = window.devicePixelRatio || 1

    this.hal.resize(canvasWidth, canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)

    const isLine = state.renderingType === RENDERING_TYPE_LINE
    const passId = isLine ? PASS_LINE : PASS_FILL

    for (const block of blocks) {
      if (this.hal.getBufferCount(block.regionNumber, PASS_FILL) === 0) {
        continue
      }

      const meta = this.hal.getRegionMeta(block.regionNumber)
      const info = this.regionInfo.get(block.regionNumber)
      if (!meta || !info) {
        continue
      }

      const scissorX = Math.max(0, Math.floor(block.screenStartPx))
      const scissorEnd = Math.min(canvasWidth, Math.ceil(block.screenEndPx))
      const scissorW = scissorEnd - scissorX
      if (scissorW <= 0) {
        continue
      }

      const pxX = Math.round(scissorX * dpr)
      const pxW = Math.round(scissorW * dpr)
      const pxH = Math.round(canvasHeight * dpr)

      this.hal.setScissor(pxX, 0, pxW, pxH)
      this.hal.setViewport(pxX, 0, pxW, pxH)

      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const regionLengthBp = block.bpRangeX[1] - block.bpRangeX[0]
      const bpPerPx = regionLengthBp / fullBlockWidth
      const clippedBpStart =
        block.bpRangeX[0] + (scissorX - block.screenStartPx) * bpPerPx
      const clippedBpEnd =
        block.bpRangeX[0] + (scissorEnd - block.screenStartPx) * bpPerPx
      const [bpStartHi, bpStartLo] = splitPositionWithFrac(clippedBpStart)
      const clippedLengthBp = clippedBpEnd - clippedBpStart

      this.uniformF32[0] = bpStartHi
      this.uniformF32[1] = bpStartLo
      this.uniformF32[2] = clippedLengthBp
      this.uniformU32[3] = Math.floor(meta.regionStart)
      this.uniformF32[4] = canvasHeight
      this.uniformI32[5] = state.scaleType
      this.uniformI32[6] = state.renderingType
      this.uniformF32[7] = info.numRows
      this.uniformF32[8] = state.domainY[0]
      this.uniformF32[9] = state.domainY[1]
      this.uniformF32[10] = 0 // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
      this.uniformF32[11] = pxW
      this.uniformF32[12] = block.reversed ? 1.0 : 0.0

      this.hal.writeUniforms(this.uniformData)
      this.hal.drawPass(passId, block.regionNumber, PASS_FILL)
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  dispose() {
    this.regionInfo.clear()
    this.hal.dispose()
  }
}
