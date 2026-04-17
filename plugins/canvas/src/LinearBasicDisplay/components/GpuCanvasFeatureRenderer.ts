import {
  clipBlock,
  writeBpRangeUniforms,
} from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import {
  ARROW_VERTEX_SHADER,
  CHEVRON_VERTEX_SHADER,
  LINE_VERTEX_SHADER,
  RECT_FRAGMENT_SHADER,
  RECT_VERTEX_SHADER,
  SIMPLE_FRAGMENT_SHADER,
} from './canvasGlslShaders.ts'
import {
  ARROW_SHADER,
  CHEVRON_SHADER,
  LINE_SHADER,
  RECT_SHADER,
} from './canvasShaders.ts'
import {
  ARROW_STRIDE,
  LINE_STRIDE,
  RECT_STRIDE,
  interleaveArrows,
  interleaveLines,
  interleaveRects,
} from './interleaveBuffers.ts'
import {
  GL_ATTRIBUTES as RECT_GL_ATTRIBUTES,
  INSTANCE_STRIDE_BYTES as RECT_INSTANCE_STRIDE_BYTES,
  UNIFORMS_SIZE_BYTES,
  UNIFORM_OFFSET_F32,
} from './shaders/rect.generated.ts'
import { MAX_VISIBLE_CHEVRONS_PER_LINE } from './sharedRendererConstants.ts'

import type {
  CanvasFeatureBackend,
  FeatureRenderBlock,
} from './canvasFeatureBackendTypes.ts'
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'
const PASS_LINE = 'line'
const PASS_CHEVRON = 'chevron'
const PASS_ARROW = 'arrow'

// Uniform byte layout lives in rect.slang (shared across all canvas-feature
// passes — line/chevron/arrow still hand-written WGSL/GLSL use the same
// uniform block, so rect.slang's reflection is the canonical source).
const U_REGION_START = UNIFORM_OFFSET_F32.regionStart
const U_CANVAS_HEIGHT = UNIFORM_OFFSET_F32.canvasHeight
const U_CANVAS_WIDTH = UNIFORM_OFFSET_F32.canvasWidth
const U_SCROLL_Y = UNIFORM_OFFSET_F32.scrollY
const U_BP_PER_PX = UNIFORM_OFFSET_F32.bpPerPx
const U_REVERSED = UNIFORM_OFFSET_F32.reversed

const LINE_ATTRS = [
  {
    name: 'a_start_end',
    components: 2,
    type: 'uint' as const,
    offsetBytes: 0,
    integer: true,
  },
  {
    name: 'a_y',
    components: 1,
    type: 'float' as const,
    offsetBytes: 8,
    integer: false,
  },
  {
    name: 'a_direction',
    components: 1,
    type: 'float' as const,
    offsetBytes: 12,
    integer: false,
  },
  {
    name: 'a_color',
    components: 4,
    type: 'float' as const,
    offsetBytes: 16,
    integer: false,
  },
]

export const CANVAS_FEATURE_PASSES: PassDescriptor[] = [
  {
    id: PASS_RECT,
    wgslSource: RECT_SHADER,
    glslVertex: RECT_VERTEX_SHADER,
    glslFragment: RECT_FRAGMENT_SHADER,
    instanceStride: RECT_INSTANCE_STRIDE_BYTES,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [...RECT_GL_ATTRIBUTES],
    vertexBuffer: true,
  },
  {
    id: PASS_LINE,
    wgslSource: LINE_SHADER,
    glslVertex: LINE_VERTEX_SHADER,
    glslFragment: SIMPLE_FRAGMENT_SHADER,
    instanceStride: LINE_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: LINE_ATTRS,
  },
  {
    id: PASS_CHEVRON,
    wgslSource: CHEVRON_SHADER,
    glslVertex: CHEVRON_VERTEX_SHADER,
    glslFragment: SIMPLE_FRAGMENT_SHADER,
    instanceStride: LINE_STRIDE * 4,
    verticesPerInstance: MAX_VISIBLE_CHEVRONS_PER_LINE * 12,
    blend: true,
    glAttributes: LINE_ATTRS,
  },
  {
    id: PASS_ARROW,
    wgslSource: ARROW_SHADER,
    glslVertex: ARROW_VERTEX_SHADER,
    glslFragment: SIMPLE_FRAGMENT_SHADER,
    instanceStride: ARROW_STRIDE * 4,
    verticesPerInstance: 9,
    blend: true,
    glAttributes: [
      {
        name: 'a_x',
        components: 1,
        type: 'uint',
        offsetBytes: 0,
        integer: true,
      },
      {
        name: 'a_color_a',
        components: 1,
        type: 'float',
        offsetBytes: 4,
        integer: false,
      },
      {
        name: 'a_y',
        components: 1,
        type: 'float',
        offsetBytes: 8,
        integer: false,
      },
      {
        name: 'a_direction',
        components: 1,
        type: 'float',
        offsetBytes: 12,
        integer: false,
      },
      {
        name: 'a_color_r',
        components: 1,
        type: 'float',
        offsetBytes: 16,
        integer: false,
      },
      {
        name: 'a_color_g',
        components: 1,
        type: 'float',
        offsetBytes: 20,
        integer: false,
      },
      {
        name: 'a_color_b',
        components: 1,
        type: 'float',
        offsetBytes: 24,
        integer: false,
      },
    ],
  },
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
