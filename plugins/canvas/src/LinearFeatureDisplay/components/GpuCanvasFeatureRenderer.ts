import {
  clipBlock,
  writeBpRangeUniforms,
} from '@jbrowse/core/gpu/blockClipUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'

import {
  ARROW_VERTEX_SHADER,
  CHEVRON_VERTEX_SHADER,
  LINE_VERTEX_SHADER,
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
import { MAX_VISIBLE_CHEVRONS_PER_LINE } from './sharedRendererConstants.ts'

import type {
  CanvasFeatureBackend,
  FeatureRenderBlock,
} from './canvasFeatureBackendTypes.ts'
import type { RegionGpuData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'
const PASS_LINE = 'line'
const PASS_CHEVRON = 'chevron'
const PASS_ARROW = 'arrow'

const UNIFORM_BYTE_SIZE = 48

const U_REGION_START = 3
const U_CANVAS_HEIGHT = 4
const U_CANVAS_WIDTH = 5
const U_SCROLL_Y = 6
const U_BP_PER_PX = 7
// U_ZERO = 8 (always 0, never written)
const U_REVERSED = 9

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
    glslFragment: SIMPLE_FRAGMENT_SHADER,
    instanceStride: RECT_STRIDE * 4,
    verticesPerInstance: 6,
    blend: true,
    glAttributes: [
      {
        name: 'a_start_end',
        components: 2,
        type: 'uint',
        offsetBytes: 0,
        integer: true,
      },
      {
        name: 'a_y',
        components: 1,
        type: 'float',
        offsetBytes: 8,
        integer: false,
      },
      {
        name: 'a_height',
        components: 1,
        type: 'float',
        offsetBytes: 12,
        integer: false,
      },
      {
        name: 'a_color',
        components: 4,
        type: 'float',
        offsetBytes: 16,
        integer: false,
      },
    ],
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

export { UNIFORM_BYTE_SIZE as CANVAS_FEATURE_UNIFORM_BYTE_SIZE }

export class GpuCanvasFeatureRenderer implements CanvasFeatureBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(UNIFORM_BYTE_SIZE)
  private uniformF32 = new Float32Array(this.uniformData)
  private uniformU32 = new Uint32Array(this.uniformData)
  private regionStarts = new Map<number, number>()
  private hasLines = new Map<number, boolean>()
  private hasArrows = new Map<number, boolean>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(regionNumber: number, data: RegionGpuData) {
    this.hal.deleteRegion(regionNumber)
    this.regionStarts.delete(regionNumber)
    this.hasLines.delete(regionNumber)
    this.hasArrows.delete(regionNumber)

    if (data.numRects === 0 && data.numLines === 0 && data.numArrows === 0) {
      return
    }

    this.regionStarts.set(regionNumber, data.regionStart)

    if (data.numRects > 0) {
      const buf = interleaveRects(
        data.rectPositions,
        data.rectYs,
        data.rectHeights,
        data.rectColors,
        data.numRects,
      )
      this.hal.uploadBuffer(regionNumber, PASS_RECT, buf, data.numRects)
    }

    if (data.numLines > 0) {
      const buf = interleaveLines(
        data.linePositions,
        data.lineYs,
        data.lineDirections,
        data.lineColors,
        data.numLines,
      )
      this.hal.uploadBuffer(regionNumber, PASS_LINE, buf, data.numLines)
      this.hasLines.set(regionNumber, true)
    }

    if (data.numArrows > 0) {
      const buf = interleaveArrows(
        data.arrowXs,
        data.arrowYs,
        data.arrowDirections,
        data.arrowColors,
        data.numArrows,
      )
      this.hal.uploadBuffer(regionNumber, PASS_ARROW, buf, data.numArrows)
      this.hasArrows.set(regionNumber, true)
    }
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    const { canvasWidth, canvasHeight, scrollY } = state
    const dpr = window.devicePixelRatio || 1

    this.hal.resize(canvasWidth, canvasHeight)

    if (this.regionStarts.size === 0) {
      return
    }

    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      const regionStart = this.regionStarts.get(block.regionNumber)
      if (regionStart === undefined) {
        continue
      }
      if (
        this.hal.getBufferCount(block.regionNumber, PASS_RECT) === 0 &&
        !this.hasLines.get(block.regionNumber) &&
        !this.hasArrows.get(block.regionNumber)
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
      this.uniformU32[U_REGION_START] = Math.floor(regionStart)
      this.uniformF32[U_CANVAS_HEIGHT] = canvasHeight
      this.uniformF32[U_CANVAS_WIDTH] = clip.scissorW
      this.uniformF32[U_SCROLL_Y] = scrollY
      this.uniformF32[U_BP_PER_PX] = clip.bpPerPx
      this.uniformF32[U_REVERSED] = block.reversed ? 1 : 0

      this.hal.writeUniforms(this.uniformData)

      if (this.hasLines.get(block.regionNumber)) {
        this.hal.drawPass(PASS_LINE, block.regionNumber)
        this.hal.drawPass(PASS_CHEVRON, block.regionNumber, PASS_LINE)
      }

      this.hal.drawPass(PASS_RECT, block.regionNumber)

      if (this.hasArrows.get(block.regionNumber)) {
        this.hal.drawPass(PASS_ARROW, block.regionNumber)
      }
    }

    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  pruneRegions(activeRegions: number[]) {
    pruneRegionMap(this.regionStarts, activeRegions, n => {
      this.hal.deleteRegion(n)
      this.hasLines.delete(n)
      this.hasArrows.delete(n)
    })
  }

  dispose() {
    this.regionStarts.clear()
    this.hasLines.clear()
    this.hasArrows.clear()
    this.hal.dispose()
  }
}
