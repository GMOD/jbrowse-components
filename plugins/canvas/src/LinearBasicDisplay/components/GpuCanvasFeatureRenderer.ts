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
  packLines,
  packRects,
  rectShader,
} from '../passes/index.ts'
import { GLYPH_LAYERS } from './glyphLayers.ts'
import {
  MAX_VISIBLE_CHEVRONS_PER_LINE,
  canvasEdgeFlags,
} from './sharedRendererConstants.ts'

import type { RegionRenderData } from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type {
  FeatureRenderBlock,
  RenderState,
} from './canvasFeatureRenderingBackendTypes.ts'
import type { GlyphLayerId } from './glyphLayers.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { GpuHal, PipelineDescriptor } from '@jbrowse/render-core/hal'
import type { InstancePass } from '@jbrowse/render-core/instancePass'

export const CANVAS_FEATURE_UNIFORM_BYTE_SIZE = FEATURE_GLYPH_UNIFORM_BYTE_SIZE

// Rect's buffer serves two passes — the continuation markers draw from this same
// instance data — which is why `strand` rides along even though the rect shader
// never reads it.
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

const UPLOADED_PASSES = [RECT_INSTANCES, LINE_INSTANCES, ARROW_INSTANCES]

export const CANVAS_FEATURE_PASSES: PipelineDescriptor[] = [
  ...UPLOADED_PASSES,
  // Chevron draws from line's vertex buffer and continuation from rect's, so
  // each declares the layout its lender does and neither is uploaded to.
  makeChevronPass(MAX_VISIBLE_CHEVRONS_PER_LINE),
  ContinuationPass,
]

type CanvasEdges = ReturnType<typeof canvasEdgeFlags>

type GpuGlyphDrawFn = (
  hal: GpuHal,
  regionKey: number,
  edges: CanvasEdges,
) => void

// `drawPass` short-circuits a region with no buffer for the pass, so every layer
// issues unconditionally rather than off has-rects / has-lines flags.
export const GPU_GLYPH_DRAW: Record<GlyphLayerId, GpuGlyphDrawFn> = {
  line: (hal, key) => {
    hal.drawPass(PASS_LINE, key)
    hal.drawPass(PASS_CHEVRON, key, PASS_LINE)
  },
  rect: (hal, key) => {
    hal.drawPass(PASS_RECT, key)
  },
  arrow: (hal, key) => {
    hal.drawPass(PASS_ARROW, key)
  },
  // The pass runs one instance per rect and each self-culls unless it straddles
  // a canvas edge, so an interior block would shade a whole pileup's worth of
  // vertices to draw nothing.
  continuation: (hal, key, edges) => {
    if (edges.leftIsCanvasEdge || edges.rightIsCanvasEdge) {
      hal.drawPass(PASS_CONTINUATION, key, PASS_RECT)
    }
  },
}

export class GpuCanvasFeatureRenderer extends GpuPerRegionRenderingBackend<
  RegionRenderData,
  RenderState
> {
  protected regionPasses = UPLOADED_PASSES

  constructor(hal: GpuHal) {
    super(hal, CANVAS_FEATURE_UNIFORM_BYTE_SIZE)
  }

  protected drawRegion(
    block: FeatureRenderBlock,
    clip: BlockClipResult,
    region: RegionRenderData,
    state: RenderState,
  ) {
    const edges = canvasEdgeFlags(
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
      leftIsCanvasEdge: edges.leftIsCanvasEdge ? 1 : 0,
      rightIsCanvasEdge: edges.rightIsCanvasEdge ? 1 : 0,
    })

    this.hal.writeUniforms(this.uniformData)

    for (const id of GLYPH_LAYERS) {
      GPU_GLYPH_DRAW[id](this.hal, block.displayedRegionIndex, edges)
    }
  }
}
