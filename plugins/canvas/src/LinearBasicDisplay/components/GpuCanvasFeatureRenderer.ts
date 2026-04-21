import { bpRangeXTuple, clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { pruneRegionMap } from '@jbrowse/core/gpu/pruneRegionMap'
import { slangPass } from '@jbrowse/core/gpu/slangPass'

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
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'
const PASS_LINE = 'line'
const PASS_CHEVRON = 'chevron'
const PASS_ARROW = 'arrow'

export const CANVAS_FEATURE_UNIFORM_BYTE_SIZE = rectShader.UNIFORMS_SIZE_BYTES

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

interface RegionMeta {
  start: number
  hasRects: boolean
  hasLines: boolean
  hasArrows: boolean
  outlineColor: number
}

export class GpuCanvasFeatureRenderer implements CanvasFeatureBackend {
  private hal: GpuHal
  private uniformData = new ArrayBuffer(CANVAS_FEATURE_UNIFORM_BYTE_SIZE)
  private regions = new Map<number, RegionMeta>()

  constructor(hal: GpuHal) {
    this.hal = hal
  }

  uploadRegion(displayedRegionIndex: number, data: RegionRenderData) {
    this.hal.deleteRegion(displayedRegionIndex)
    this.regions.delete(displayedRegionIndex)

    const numRects = data.rectYs.length
    const numLines = data.lineYs.length
    const numArrows = data.arrowYs.length

    if (numRects === 0 && numLines === 0 && numArrows === 0) {
      return
    }

    this.regions.set(displayedRegionIndex, {
      start: data.regionStart,
      hasRects: numRects > 0,
      hasLines: numLines > 0,
      hasArrows: numArrows > 0,
      outlineColor: data.outlineColor,
    })

    if (numRects > 0) {
      const buf = interleaveRects(
        data.rectPositions,
        data.rectYs,
        data.rectHeights,
        data.rectColors,
        numRects,
      )
      this.hal.uploadBuffer(displayedRegionIndex, PASS_RECT, buf, numRects)
    }

    if (numLines > 0) {
      const buf = interleaveLines(
        data.linePositions,
        data.lineYs,
        data.lineDirections,
        data.lineColors,
        numLines,
      )
      this.hal.uploadBuffer(displayedRegionIndex, PASS_LINE, buf, numLines)
    }

    if (numArrows > 0) {
      const buf = interleaveArrows(
        data.arrowXs,
        data.arrowYs,
        data.arrowDirections,
        data.arrowColors,
        numArrows,
      )
      this.hal.uploadBuffer(displayedRegionIndex, PASS_ARROW, buf, numArrows)
    }
  }

  renderBlocks(
    blocks: FeatureRenderBlock[],
    state: { scrollY: number; canvasWidth: number; canvasHeight: number },
  ) {
    const { canvasWidth, canvasHeight, scrollY } = state
    const dpr = getDpr()

    this.hal.resize(canvasWidth, canvasHeight)

    if (this.regions.size === 0) {
      return
    }

    this.hal.beginFrame(0, 0, 0, 0)

    for (const block of blocks) {
      const meta = this.regions.get(block.displayedRegionIndex)
      if (!meta) {
        continue
      }

      const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
      if (!clip) {
        continue
      }

      this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
      this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

      rectShader.writeUniforms(this.uniformData, {
        bpRangeX: bpRangeXTuple(clip, block.reversed),
        regionStart: Math.floor(meta.start),
        canvasHeight,
        canvasWidth: clip.scissorW,
        scrollY,
        bpPerPx: clip.bpPerPx,
        zero: 0,
        reversed: block.reversed ? 1 : 0,
        outlineColor: meta.outlineColor,
      })

      this.hal.writeUniforms(this.uniformData)

      if (meta.hasLines) {
        this.hal.drawPass(PASS_LINE, block.displayedRegionIndex)
        this.hal.drawPass(PASS_CHEVRON, block.displayedRegionIndex, PASS_LINE)
      }

      if (meta.hasRects) {
        this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
      }

      if (meta.hasArrows) {
        this.hal.drawPass(PASS_ARROW, block.displayedRegionIndex)
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
