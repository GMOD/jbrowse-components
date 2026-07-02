import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import {
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  canvasEdgeFlags,
} from './sharedRendererConstants.ts'
import {
  ARROW_PASS as PASS_ARROW,
  ArrowPass,
  CHEVRON_PASS as PASS_CHEVRON,
  CONTINUATION_PASS as PASS_CONTINUATION,
  ContinuationPass,
  FEATURE_GLYPH_UNIFORM_BYTE_SIZE,
  LINE_PASS as PASS_LINE,
  LinePass,
  RECT_PASS as PASS_RECT,
  RectPass,
  makeChevronPass,
  packArrows,
  packContinuations,
  packLines,
  packRects,
  rectShader,
} from '../passes/index.ts'

import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'

export const CANVAS_FEATURE_UNIFORM_BYTE_SIZE = FEATURE_GLYPH_UNIFORM_BYTE_SIZE

export const CANVAS_FEATURE_PASSES: PassDescriptor[] = [
  RectPass,
  LinePass,
  // Chevron reads line's vertex buffer via drawPass(chevron, region,
  // bufferPassId=line), so its attribute layout must match line's.
  makeChevronPass(MAX_VISIBLE_CHEVRONS_PER_LINE),
  ArrowPass,
  // Has its own buffer (rect geometry + strand) uploaded alongside rects.
  ContinuationPass,
]

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
      const buf = packRects(
        {
          startEnd: data.rectPositions,
          y: data.rectYs,
          height: data.rectHeights,
          color: data.rectColors,
          densityFade: data.rectDensityFade,
        },
        numRects,
      )
      this.hal.uploadBuffer(displayedRegionIndex, PASS_RECT, buf, numRects)

      const contBuf = packContinuations(
        {
          startEnd: data.rectPositions,
          y: data.rectYs,
          height: data.rectHeights,
          color: data.rectColors,
          strand: data.rectStrands,
        },
        numRects,
      )
      this.hal.uploadBuffer(
        displayedRegionIndex,
        PASS_CONTINUATION,
        contBuf,
        numRects,
      )
    }

    const numLines = data.lineYs.length
    if (numLines > 0) {
      const buf = packLines(
        {
          startEnd: data.linePositions,
          y: data.lineYs,
          direction: data.lineDirections,
          color: data.lineColors,
        },
        numLines,
      )
      this.hal.uploadBuffer(displayedRegionIndex, PASS_LINE, buf, numLines)
    }

    const numArrows = data.arrowYs.length
    if (numArrows > 0) {
      const buf = packArrows(
        {
          x: data.arrowXs,
          y: data.arrowYs,
          direction: data.arrowDirections,
          color: data.arrowColors,
        },
        numArrows,
      )
      this.hal.uploadBuffer(displayedRegionIndex, PASS_ARROW, buf, numArrows)
    }
  }

  protected drawRegion(
    block: FeatureRenderBlock,
    clip: BlockClipResult,
    region: RegionRenderData,
    state: RenderState,
  ) {
    // Continuation markers only fire where the block edge is the real canvas
    // edge, not a seam between two on-screen displayedRegions.
    const { leftIsCanvasEdge, rightIsCanvasEdge } = canvasEdgeFlags(
      clip.scissorX,
      clip.scissorW,
      state.canvasWidth,
    )
    rectShader.writeUniforms(this.uniformData, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: state.canvasHeight,
      canvasWidth: clip.scissorW,
      scrollY: state.scrollY,
      bpPerPx: clip.bpPerPx,
      zero: 0,
      reversed: block.reversed ? 1 : 0,
      outlineColor: region.outlineColor,
      leftIsCanvasEdge: leftIsCanvasEdge ? 1 : 0,
      rightIsCanvasEdge: rightIsCanvasEdge ? 1 : 0,
    })

    this.hal.writeUniforms(this.uniformData)

    // HAL.drawPass short-circuits when the region has no buffer for that pass,
    // so we can issue every pass unconditionally instead of caching has-rects /
    // has-lines / has-arrows flags on the renderer.
    this.hal.drawPass(PASS_LINE, block.displayedRegionIndex)
    this.hal.drawPass(PASS_CHEVRON, block.displayedRegionIndex, PASS_LINE)
    this.hal.drawPass(PASS_RECT, block.displayedRegionIndex)
    this.hal.drawPass(PASS_ARROW, block.displayedRegionIndex)
    // Drawn last so the "feature keeps going" markers sit on top of the glyph
    // they annotate.
    this.hal.drawPass(PASS_CONTINUATION, block.displayedRegionIndex)
  }
}
