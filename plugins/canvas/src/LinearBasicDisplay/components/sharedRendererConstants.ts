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

// Drawing dimensions (in pixels) — authored in the shared pass-library shaders,
// re-exported here so display-side modules import them from one place. Sourced
// from `passes/constants.ts`, NOT `passes/index.ts`: this module is eager (layout
// ← baseModel ← the plugin entry), and the pass barrel namespace-imports the
// generated shader source, which would then ride into the always-loaded chunk.
export {
  ARROW_MIN_FEATURE_WIDTH_PX,
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
} from '../passes/constants.ts'
