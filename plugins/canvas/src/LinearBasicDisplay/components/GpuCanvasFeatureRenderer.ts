import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { GpuPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import {
  ArrowPass,
  ContinuationPass,
  FEATURE_GLYPH_UNIFORM_BYTE_SIZE,
  LinePass,
  ARROW_PASS as PASS_ARROW,
  CHEVRON_PASS as PASS_CHEVRON,
  CONTINUATION_PASS as PASS_CONTINUATION,
  LINE_PASS as PASS_LINE,
  RECT_PASS as PASS_RECT,
  RectPass,
  makeChevronPass,
  packArrows,
  packContinuations,
  packLines,
  packRects,
  rectShader,
} from '../passes/index.ts'
import {
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  canvasEdgeFlags,
} from './sharedRendererConstants.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PassDescriptor } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'

export const CANVAS_FEATURE_UNIFORM_BYTE_SIZE = FEATURE_GLYPH_UNIFORM_BYTE_SIZE

// The glyph passes in `../passes` are deliberately payload-agnostic (RFC-001
// §5's shared shape library), so each is bound to this display's RPC payload
// here rather than there. Every one of them names the same count twice over —
// the packer's loop bound and the instance count handed to the HAL — so the
// binding is where that stops: `uploadPass` reads the count off the bytes the
// packer allocated.
const RECT_INSTANCES: InstancePass<RegionRenderData> = {
  ...RectPass,
  pack: data =>
    packRects(
      {
        startEnd: data.rectPositions,
        y: data.rectYs,
        height: data.rectHeights,
        color: data.rectColors,
        densityFade: data.rectDensityFade,
      },
      data.rectYs.length,
    ),
}

// Its own buffer (rect geometry + strand), from the same rects.
const CONTINUATION_INSTANCES: InstancePass<RegionRenderData> = {
  ...ContinuationPass,
  pack: data =>
    packContinuations(
      {
        startEnd: data.rectPositions,
        y: data.rectYs,
        height: data.rectHeights,
        color: data.rectColors,
        strand: data.rectStrands,
      },
      data.rectYs.length,
    ),
}

const LINE_INSTANCES: InstancePass<RegionRenderData> = {
  ...LinePass,
  pack: data =>
    packLines(
      {
        startEnd: data.linePositions,
        y: data.lineYs,
        height: data.lineHeights,
        direction: data.lineDirections,
        color: data.lineColors,
      },
      data.lineYs.length,
    ),
}

const ARROW_INSTANCES: InstancePass<RegionRenderData> = {
  ...ArrowPass,
  pack: data =>
    packArrows(
      {
        x: data.arrowXs,
        y: data.arrowYs,
        height: data.arrowHeights,
        widthBp: data.arrowWidthsBp,
        direction: data.arrowDirections,
        color: data.arrowColors,
      },
      data.arrowYs.length,
    ),
}

export const CANVAS_FEATURE_PASSES: PassDescriptor[] = [
  RECT_INSTANCES,
  LINE_INSTANCES,
  // Chevron reads line's vertex buffer via drawPass(chevron, region,
  // bufferPassId=line), so its attribute layout must match line's — and so it
  // is registered but never uploaded to.
  makeChevronPass(MAX_VISIBLE_CHEVRONS_PER_LINE),
  ARROW_INSTANCES,
  CONTINUATION_INSTANCES,
]

export class GpuCanvasFeatureRenderer extends GpuPerRegionRenderingBackend<
  RegionRenderData,
  RenderState
> {
  protected regionPasses = [
    RECT_INSTANCES,
    LINE_INSTANCES,
    ARROW_INSTANCES,
    CONTINUATION_INSTANCES,
  ]

  constructor(hal: GpuHal) {
    super(hal, CANVAS_FEATURE_UNIFORM_BYTE_SIZE)
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
    // they annotate. The pass runs one instance per rect and every instance
    // self-culls to OFFSCREEN unless it straddles a canvas edge, so an interior
    // block in a multi-region view, where no instance can qualify, would shade a
    // full pileup's worth of vertices to draw nothing. Skip it there, as the
    // Canvas2D path already skips its equivalent per-rect scan.
    if (leftIsCanvasEdge || rightIsCanvasEdge) {
      this.hal.drawPass(PASS_CONTINUATION, block.displayedRegionIndex)
    }
  }
}
