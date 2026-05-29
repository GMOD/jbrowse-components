import { bpRangeXTuple, clipBlock } from '@jbrowse/core/gpu/blockClipUtils'
import { getDpr } from '@jbrowse/core/gpu/canvas2dUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/core/gpu/perRegionRenderingBackend'
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
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { GpuHal, PassDescriptor } from '@jbrowse/core/gpu/hal'

const PASS_RECT = 'rect'
const PASS_LINE = 'line'
const PASS_CHEVRON = 'chevron'
const PASS_ARROW = 'arrow'

export const CANVAS_FEATURE_UNIFORM_BYTE_SIZE = rectShader.UNIFORMS_SIZE_BYTES

export const CANVAS_FEATURE_PASSES: PassDescriptor[] = [
  slangPass({ id: PASS_RECT, mod: rectShader }),
  slangPass({ id: PASS_LINE, mod: lineShader }),
  // Chevron reads line's vertex buffer via drawPass(chevron, region,
  // bufferPassId=line), so its attribute layout must match line's.
  slangPass({
    id: PASS_CHEVRON,
    mod: chevronShader,
    verticesPerInstance: MAX_VISIBLE_CHEVRONS_PER_LINE * 12,
    bufferStride: lineShader.INSTANCE_STRIDE_BYTES,
    bufferAttributes: lineShader.GL_ATTRIBUTES,
  }),
  slangPass({ id: PASS_ARROW, mod: arrowShader }),
]

function drawRegionBlock(
  hal: GpuHal,
  uniformData: ArrayBuffer,
  block: FeatureRenderBlock,
  region: RegionRenderData,
  state: RenderState,
  dpr: number,
) {
  const { canvasWidth, canvasHeight, scrollY } = state
  const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
  if (!clip) {
    return
  }

  hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
  hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)

  rectShader.writeUniforms(uniformData, {
    bpRangeX: bpRangeXTuple(clip, block.reversed),
    canvasHeight,
    canvasWidth: clip.scissorW,
    scrollY,
    bpPerPx: clip.bpPerPx,
    zero: 0,
    reversed: block.reversed ? 1 : 0,
    outlineColor: region.outlineColor,
  })

  hal.writeUniforms(uniformData)

  // HAL.drawPass short-circuits when the region has no buffer for that pass,
  // so we can issue all three unconditionally instead of caching has-rects /
  // has-lines / has-arrows flags on the renderer.
  hal.drawPass(PASS_LINE, block.displayedRegionIndex)
  hal.drawPass(PASS_CHEVRON, block.displayedRegionIndex, PASS_LINE)
  hal.drawPass(PASS_RECT, block.displayedRegionIndex)
  hal.drawPass(PASS_ARROW, block.displayedRegionIndex)
}

export class GpuCanvasFeatureRenderer extends GpuPerRegionRenderingBackend<
  RegionRenderData,
  RenderState
> {
  constructor(hal: GpuHal) {
    super(hal, CANVAS_FEATURE_UNIFORM_BYTE_SIZE)
  }

  uploadRegion(displayedRegionIndex: number, data: RegionRenderData) {
    this.hal.deleteRegion(displayedRegionIndex)

    const numRects = data.rectYs.length
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

    const numLines = data.lineYs.length
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

    const numArrows = data.arrowYs.length
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
    regions: ReadonlyMap<number, RegionRenderData>,
    state: RenderState,
  ) {
    const dpr = getDpr()
    this.hal.resize(state.canvasWidth, state.canvasHeight)
    // Always pair beginFrame/endFrame so the canvas clears to transparent
    // even when all regions are pruned (e.g. after a density-gate reset).
    this.hal.beginFrame(0, 0, 0, 0)
    for (const block of blocks) {
      const region = regions.get(block.displayedRegionIndex)
      if (region) {
        drawRegionBlock(this.hal, this.uniformData, block, region, state, dpr)
      }
    }
    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }
}
