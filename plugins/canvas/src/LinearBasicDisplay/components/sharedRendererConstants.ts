// Re-export so display-side modules can import label dimensions/colors from one
// place. These live in RenderFeatureDataRPC so the worker can read them without
// depending on the display module.
export {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from '../../RenderFeatureDataRPC/constants.ts'

// Instancing limits
export const MAX_VISIBLE_CHEVRONS_PER_LINE = 128

// Continuation markers ("feature keeps going") fire only where a block edge is
// the true canvas edge, never an internal seam between two on-screen
// displayedRegions. Both the Canvas2D and GPU backends derive the flags from
// this one helper so the 0.5px epsilon can't drift between them (mirrors
// continuation.slang's edge gates).
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

// Overlay stacking. The overflow indicator sits on top of the canvas, label
// overlays, and amino-acid overlay (all of which sit at default z-index inside
// the scroll container). Keep above MUI's tooltip floor (1500) is unnecessary
// because the indicator's tooltip is itself MUI-managed.
export const OVERFLOW_INDICATOR_Z_INDEX = 999

// Drawing dimensions (in pixels) — authored in the shared pass-library shaders,
// re-exported here so display-side modules import them from one place.
export {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
  CONT_EDGE_MARGIN_PX,
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
  HEAD_HALF_H_PX,
  MIN_DENSITY_ALPHA,
  MIN_RECT_WIDTH_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from '../passes/index.ts'
