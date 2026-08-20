// Re-export so display-side modules can import label dimensions/colors from one
// place. These live in RenderFeatureDataRPC so the worker can read them without
// depending on the display module.
export {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from '../../RenderFeatureDataRPC/constants.ts'

// How many chevron slots the GPU pass addresses per intron line. A BUDGET, not
// a limit: `makeChevronPass` multiplies it by `CHEVRON_VERTS` for the pass's
// per-instance vertex count, so every line instance shades all 128 x 12 = 1536
// vertices whether or not a chevron lands in any slot. Raising it costs that on
// every intron on the track.
//
// 128 slots covers a block up to **5077 CSS px** wide, because `vs_main` walks
// `blockWidthPx / CHEVRON_SPACING_PX` slots plus a slot of slack across the two
// ends. `chevronWindow.test.ts` sweeps the shader's own window arithmetic to
// pin that, so the number is checked rather than remembered — it is a
// consequence of arithmetic in another file, and it moved the last time that
// arithmetic did. `193` is the 7680px figure if it ever needs raising.
//
// Past 5077px the GPU path silently drops the far-end chevrons of the longest
// lines while Canvas2D, which windows in px and has no cap, still draws them —
// the per-backend divergence class ADR-005 exists to remove. Reaching it needs
// an ultra-wide window (a spanned pair of 4K panels at 100% scaling is ~7680
// CSS px), so the trade stands: covering it would cost +51% chevron vertices
// for every user.
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

// Drawing dimensions (px), authored in the shared pass-library shaders and
// re-exported here so display-side modules import them from one place.
//
// From each shader's `.consts.generated.ts`, NEVER from `passes/index.ts`: this
// module is eager, the pass barrel namespace-imports the generated shader
// source, and a namespace import marks every export used — so reading one
// integer through the barrel puts the whole feature-glyph shader source in the
// always-loaded chunk, Canvas2D-only users included.
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
export {
  ARROW_MIN_FEATURE_WIDTH_PX,
  HEAD_HALF_H_PX,
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
