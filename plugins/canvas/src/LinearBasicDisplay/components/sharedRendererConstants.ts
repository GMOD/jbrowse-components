export {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from '../../RenderFeatureDataRPC/constants.ts'

// A budget, not a limit: `makeChevronPass` multiplies it by `CHEVRON_VERTS`, so
// every intron line shades all 128 slots whether or not a chevron lands in one.
// 128 slots cover a block up to 5077 CSS px; past that the GPU path drops the
// far-end chevrons of the longest lines, which Canvas2D still draws.
export const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Continuation markers fire only at the true canvas edge, never at an internal
// seam between two on-screen displayedRegions.
export function canvasEdgeFlags(
  scissorX: number,
  scissorW: number,
  canvasWidth: number,
) {
  return {
    leftIsCanvasEdge: scissorX <= 0.5,
    rightIsCanvasEdge: scissorX + scissorW >= canvasWidth - 0.5,
  }
}

// Take these from each shader's `.consts.generated.ts`, never from
// `passes/index.ts`: this module is eager, and a namespace import of the pass
// barrel marks every export used, dragging the whole shader source into the
// always-loaded chunk.
export {
  MIN_DENSITY_ALPHA,
  MIN_RECT_WIDTH_PX,
} from '../passes/shaders/rect.consts.generated.ts'
export {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
} from '../passes/shaders/chevron.consts.generated.ts'
// No HEAD_HALF_H_PX: `arrowHeadHalfHeightPx` clamps the arrowhead to the box it
// comes off, and re-exporting the raw ceiling is how a caller reaches past it.
export {
  ARROW_MIN_FEATURE_WIDTH_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from '../passes/shaders/arrow.consts.generated.ts'
export {
  CONT_EDGE_MARGIN_PX,
  CONT_MARK_ALPHA,
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
} from '../passes/shaders/continuation.consts.generated.ts'
