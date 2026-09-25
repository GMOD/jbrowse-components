import { CHEVRON_SPACING_PX } from '../passes/shaders/chevron.consts.generated.ts'

export {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from '../../RenderFeatureDataRPC/constants.ts'

// What `makeChevronPass` registers, and the count a draw supplying no width
// uses. The GPU path supplies one — `chevronSlotBudget` off the frame's canvas
// — so this binds nothing it draws; it stays the registered worst case because
// a `PipelineDescriptor` is built before any canvas exists.
export const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Slots a line can put on screen across a canvas this wide. The window is over
// chevron CENTRES widened by the arms, and `reach` adds under a tenth of a slot
// at any spacing `showChevrons` admits, so the ceil plus one slot is the whole
// of it — `chevronWindow.test.ts` walks the window itself against this.
export function chevronSlotBudget(canvasWidthPx: number) {
  return Math.ceil(canvasWidthPx / CHEVRON_SPACING_PX) + 1
}

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
  CHEVRON_THICKNESS_PX,
  CHEVRON_VERTS,
  CHEVRON_W_PX,
} from '../passes/shaders/chevron.consts.generated.ts'
export { CHEVRON_SPACING_PX }
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
