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

// The glyph passes in `../passes` are deliberately payload-agnostic (RFC-001
// §5's shared shape library), so each is bound to this display's RPC payload
// here rather than there. Every one of them names the same count twice over —
// the packer's loop bound and the instance count handed to the HAL — so the
// binding is where that stops: `uploadPass` reads the count off the bytes the
// packer allocated.
//
// Rect's buffer serves two passes: the continuation markers draw from this same
// instance data via drawPass(..., bufferPassId=PASS_RECT), which is why `strand`
// rides along here even though the rect shader never reads it.
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

// Every pass with a buffer of its own.
const UPLOADED_PASSES = [RECT_INSTANCES, LINE_INSTANCES, ARROW_INSTANCES]

export const CANVAS_FEATURE_PASSES: PipelineDescriptor[] = [
  ...UPLOADED_PASSES,
  // The two passes that draw from another pass's vertex buffer — chevron from
  // line's, continuation from rect's (drawPass(id, region, bufferPassId)) — so
  // each must declare the layout its lender does, which lineInstance.slang and
  // rectInstance.slang are what make true. They are the passes registered
  // without being uploaded to, so registration is the upload list plus these
  // rather than a second list of the same names.
  makeChevronPass(MAX_VISIBLE_CHEVRONS_PER_LINE),
  ContinuationPass,
]

// Whether each end of this block's clipped span is a true canvas edge, which is
// the only thing the continuation layer draws off.
type CanvasEdges = ReturnType<typeof canvasEdgeFlags>

type GpuGlyphDrawFn = (
  hal: GpuHal,
  regionKey: number,
  edges: CanvasEdges,
) => void

// Each glyph layer's GPU draw. The set and the paint order live in the shared
// `GLYPH_LAYERS` list (also driving the Canvas2D renderer and, through it, the
// SVG export); this map resolves each id to the `drawPass` calls that issue it,
// and is typed `Record<GlyphLayerId, …>` so a glyph added to that list is a
// compile error here until it is drawn.
//
// `drawPass` short-circuits a region with no buffer for the pass, so every layer
// issues unconditionally rather than off has-rects / has-lines flags.
export const GPU_GLYPH_DRAW: Record<GlyphLayerId, GpuGlyphDrawFn> = {
  // Two passes, one layer: the chevrons draw from line's own vertex buffer
  // (`bufferPassId`), which is a GPU buffer-sharing artifact and not a second
  // place in the order — Canvas2D paints them inside `drawLines`.
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
  // Last, so the "feature keeps going" markers sit on top of the glyph they
  // annotate, and from the rect buffer since its instances ARE the rects. The
  // pass runs one instance per rect and every instance self-culls to OFFSCREEN
  // unless it straddles a canvas edge, so an interior block in a multi-region
  // view, where no instance can qualify, would shade a full pileup's worth of
  // vertices to draw nothing. Skip it there, as the Canvas2D path already skips
  // its equivalent per-rect scan.
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
    // Continuation markers only fire where the block edge is the real canvas
    // edge, not a seam between two on-screen displayedRegions.
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
