import {
  CHEVRON_END_GAP_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_W_PX,
} from '../passes/shaders/chevron.consts.generated.ts'
import {
  chevronFirstIndex,
  chevronGridBp,
  chevronLastIndex,
  chevronPhaseBp,
} from '../passes/shaders/chevron.js.generated.ts'

export {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from '../../RenderFeatureDataRPC/constants.ts'

// Slots a line can put on screen across a canvas this wide: grid points sit at
// least CHEVRON_SPACING_PX apart, and the arms' reach past the edges can add
// one more.
export function chevronSlotBudget(canvasWidthPx: number) {
  return Math.ceil(canvasWidthPx / CHEVRON_SPACING_PX) + 2
}

// The slots one draw shades: no line holds more grid points than its length
// over the spacing plus one, and the spare slot absorbs the shader's float32
// rounding. `longestLinePx` 0 means no line in the draw carries chevrons.
export function chevronDrawSlots(viewportPx: number, longestLinePx: number) {
  return longestLinePx > 0
    ? Math.min(
        chevronSlotBudget(viewportPx),
        Math.floor(longestLinePx / CHEVRON_SPACING_PX) + 2,
      )
    : 0
}

/**
 * The grid points chevron.slang draws on a line, as bp offsets from its start:
 * `phase + k * grid` for `k` from `first` to `last`, kept clear of the line's
 * ends and, given a window in bp from the line's start, to the ones whose arms
 * reach it.
 */
export function chevronGridWindow(
  startBp: number,
  lengthBp: number,
  bpPerPx: number,
  windowStartBp = Number.NEGATIVE_INFINITY,
  windowEndBp = Number.POSITIVE_INFINITY,
) {
  const grid = chevronGridBp(bpPerPx)
  const phase = chevronPhaseBp(startBp, grid)
  const reach = (CHEVRON_W_PX / 2) * bpPerPx
  const margin = (CHEVRON_W_PX / 2 + CHEVRON_END_GAP_PX) * bpPerPx
  return {
    grid,
    phase,
    first: chevronFirstIndex(
      Math.max(margin, windowStartBp - reach),
      phase,
      grid,
    ),
    last: chevronLastIndex(
      Math.min(lengthBp - margin, windowEndBp + reach),
      phase,
      grid,
    ),
  }
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

// From each shader's `.consts.generated.ts`, never `passes/index.ts`, so this
// eager module doesn't pull in every pass descriptor and its packer. The rect
// floors are render-core's, shared with the mark display's rects.
export { MIN_DENSITY_ALPHA } from '../passes/shaders/rect.consts.generated.ts'
export {
  MIN_RECT_WIDTH_PX,
  SPARSE_RECT_MIN_WIDTH_PX,
} from '@jbrowse/render-core/shaders/rowRectConsts'
export {
  INSET_HEIGHT_FRACTION,
  RECT_FLAG_DENSITY_FADE,
  RECT_FLAG_INSET,
  RECT_FLAG_SPARSE_EXONS,
} from '../passes/shaders/rectInstance.generated.ts'
export {
  CHEVRON_THICKNESS_PX,
  CHEVRON_VERTS,
  CHEVRON_W_PX,
} from '../passes/shaders/chevron.consts.generated.ts'
export { CHEVRON_SPACING_PX }
// No HEAD_HALF_H_PX: `arrowHeadHalfHeightPx` clamps the arrowhead to the box it
// comes off, and re-exporting the raw ceiling is how a caller reaches past it.
export {
  ARROW_LENGTH_PX,
  ARROW_MIN_FEATURE_WIDTH_PX,
  GENE_ARROW_MIN_FEATURE_WIDTH_PX,
  STEM_HALF_H_PX,
} from '../passes/shaders/arrow.consts.generated.ts'
export {
  CONT_EDGE_MARGIN_PX,
  CONT_MARK_ALPHA,
  CONT_MIN_OVERHANG_PX,
  CONT_STROKE_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
} from '../passes/shaders/continuation.consts.generated.ts'
