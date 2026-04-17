import {
  clipBlock,
  writeBpRangeUniforms,
} from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import {
  interleaveArrows,
  interleaveLines,
  interleaveRects,
} from './interleaveBuffers.ts'
import * as arrowShader from './shaders/arrow.generated.ts'
import * as chevronShader from './shaders/chevron.generated.ts'
import * as lineShader from './shaders/line.generated.ts'
import * as rectShader from './shaders/rect.generated.ts'
import { MAX_VISIBLE_CHEVRONS_PER_LINE } from './sharedRendererConstants.ts'

import type {
  CanvasFeatureBackend,
  FeatureRenderBlock,
} from './canvasFeatureBackendTypes.ts'
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  GlAttributeLayout,
  GpuHal,
  PassDescriptor,
} from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'
const PASS_LINE = 'line'
const PASS_CHEVRON = 'chevron'
const PASS_ARROW = 'arrow'

// All canvas-feature passes share the same uniform block, so the offsets
// from any one shader's reflection are authoritative. Using rect.
const U_REGION_START = rectShader.UNIFORM_OFFSET_F32.regionStart
const U_CANVAS_HEIGHT = rectShader.UNIFORM_OFFSET_F32.canvasHeight
const U_CANVAS_WIDTH = rectShader.UNIFORM_OFFSET_F32.canvasWidth
const U_SCROLL_Y = rectShader.UNIFORM_OFFSET_F32.scrollY
const U_BP_PER_PX = rectShader.UNIFORM_OFFSET_F32.bpPerPx
const U_REVERSED = rectShader.UNIFORM_OFFSET_F32.reversed
const UNIFORMS_SIZE_BYTES = rectShader.UNIFORMS_SIZE_BYTES

// Build a vertex-buffer-instanced pass descriptor from a generated Slang
// shader module. Every canvas-feature pass follows the same template —
// pulling stride/attributes/sources straight from the module means adding a
// new shader is just dropping a .slang file and one line here.
interface ShaderModule {
  WGSL_SOURCE: string
  GLSL_VERTEX: string
  GLSL_FRAGMENT: string
  INSTANCE_STRIDE_BYTES: number
  GL_ATTRIBUTES: readonly GlAttributeLayout[]
}
function slangPass(opts: {
  id: string
  mod: ShaderModule
  verticesPerInstance: number
  // Override if the data buffer comes from another pass (e.g. chevron reads
  // line's instance buffer).
  bufferStride?: number
  bufferAttributes?: readonly GlAttributeLayout[]
}): PassDescriptor {
  return {
    id: opts.id,
    wgslSource: opts.mod.WGSL_SOURCE,
    glslVertex: opts.mod.GLSL_VERTEX,
    glslFragment: opts.mod.GLSL_FRAGMENT,
    instanceStride: opts.bufferStride ?? opts.mod.INSTANCE_STRIDE_BYTES,
    verticesPerInstance: opts.verticesPerInstance,
    blend: true,
    glAttributes: [...(opts.bufferAttributes ?? opts.mod.GL_ATTRIBUTES)],
    vertexBuffer: true,
  }
}

export const CANVAS_FEATURE_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_RECT, mod: rectShader, verticesPerInstance: 6 }),
  slangPass({ id: PASS_LINE, mod: lineShader, verticesPerInstance: 6 }),
  // Chevron reads line's vertex buffer via drawPass(chevron, region,
  // bufferPassId=line), so its attribute layout must match line's.
  slangPass({
    id: PASS_CHEVRON,
    mod: chevronShader,
    verticesPerInstance: MAX_VISIBLE_CHEVRONS_PER_LINE * 12,
    bufferStride: lineShader.INSTANCE_STRIDE_BYTES,
    bufferAttributes: lineShader.GL_ATTRIBUTES,
  }),
  slangPass({ id: PASS_ARROW, mod: arrowShader, verticesPerInstance: 9 }),
]

export { UNIFORMS_SIZE_BYTES as CANVAS_FEATURE_UNIFORM_BYTE_SIZE }

interface RegionMeta {
  start: number
  hasLines: boolean
  hasArrows: boolean
}

export class GpuCanvasFeatureRenderer implements CanvasFeatureBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORMS_SIZE_BYTES)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regions = new Map<number, RegionMeta>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(regionNumber: number, data: RegionRenderData) {
    this.hal.deleteRegion(regionNumber)
    this.regions.delete(regionNumber)

    const numRects = data.rectYs.length
    const numLines = data.lineYs.length
    const numArrows = data.arrowYs.length

    if (numRects === 0 && numLines === 0 && numArrows === 0) {
      return
    }

    this.regions.set(regionNumber, {
      start: data.regionStart,
      hasLines: numLines > 0,
      hasArrows: numArrows > 0,
    })

    if (numRects > 0) {
      const buf = interleaveRects(
        data.rectPositions,
        data.rectYs,
        data.rectHeights,
        data.rectColors,
        numRects,
      )
      this.hal.uploadBuffer(regionNumber, PASS_RECT, buf, numRects)
    }

    if (numLines > 0) {
      const buf = interleaveLines(
        data.linePositions,
        data.lineYs,
        data.lineDirections,
        data.lineColors,
        numLines,
      )
      this.hal.uploadBuffer(regionNumber, PASS_LINE, buf, numLines)
    }

    if (numArrows > 0) {
      const buf = interleaveArrows(
        data.arrowXs,
        data.arrowYs,
        data.arrowDirections,
        data.arrowColors,
        numArrows,
      )
      this.hal.uploadBuffer(regionNumber, PASS_ARROW, buf, numArrows)
    }
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    const { canvasWidth, canvasHeight, scrollY } = state
    const dpr = window.devicePixelRatio || 1

    this.hal.resize(canvasWidth, canvasHeight)

    if (this.regions.size === 0) {
      return
    }

    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      const meta = this.regions.get(block.regionNumber)
      if (!meta) {
        continue
      }
      if (
        this.hal.getBufferCount(block.regionNumber, PASS_RECT) === 0 &&
        !meta.hasLines &&
        !meta.hasArrows
      ) {
        continue
      }

      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      writeBpRangeUniforms(this.uniformF32, clip, block.reversed)
      this.uniformU32[U_REGION_START] = Math.floor(meta.start)
      this.uniformF32[U_CANVAS_HEIGHT] = canvasHeight
      this.uniformF32[U_CANVAS_WIDTH] = clip.scissorW
      this.uniformF32[U_SCROLL_Y] = scrollY
      this.uniformF32[U_BP_PER_PX] = clip.bpPerPx
      this.uniformF32[U_REVERSED] = block.reversed ? 1 : 0

      this.hal.writeUniforms(this.uniformData)

      if (meta.hasLines) {
        this.hal.drawPass(PASS_LINE, block.regionNumber)
        this.hal.drawPass(PASS_CHEVRON, block.regionNumber, PASS_LINE)
      }

      this.hal.drawPass(PASS_RECT, block.regionNumber)

      if (meta.hasArrows) {
        this.hal.drawPass(PASS_ARROW, block.regionNumber)
      }
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regions, activeRegions, n => {
      this.hal.deleteRegion(n)
    })
  }

  dispose() {
    this.regions.clear()
    this.hal.dispose()
  }
}
