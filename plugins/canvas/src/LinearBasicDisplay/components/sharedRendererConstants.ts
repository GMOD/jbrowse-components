// Re-export so display-side modules can import label dimensions/colors from one
// place. These live in RenderFeatureDataRPC so the worker can read them without
// depending on the display module.
export {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from '../../RenderFeatureDataRPC/constants.ts'

// How many chevron slots the GPU pass addresses per intron line. A BUDGET, not
// a limit: `makeChevronPass` multiplies it by `CHEVRON_VERTS` to get the pass's
// per-instance vertex count, so every line instance shades all 128 × 12 = 1536
// vertices whether or not a chevron lands in any of those slots. Raising it
// costs that on every intron on the track, which is why it is not simply large.
//
// What 128 buys, since nothing in the shader can say so: `vs_main` draws
// `firstVisible + localChevronIndex`, where the window it walks
// (`chevronFirstVisible`/`chevronLastVisible`) spans
// `blockWidthPx / CHEVRON_SPACING_PX` slots plus one of ceil/floor slack across
// the two ends — so this covers a block up to **5077 CSS px** wide. Measured by
// sweeping the shader's own window arithmetic over line lengths from
// just-clears-the-gate to 4096× the viewport and the viewport at every position
// along the line: 1200px block → 31 slots, 3840 → 97, 5077 → 128, 7680 → 193.
//
// The sweep needs no bpPerPx axis, which is the window being unit-agnostic doing
// its job: the shader measures in bp and Canvas2D in px, and the only ratio the
// slot count depends on is `reach / spacing`, where the conversion cancels.
//
// Past 5077px the GPU path silently drops the far-end chevrons of the longest
// lines while Canvas2D, which windows in px and has no cap, still draws them —
// the per-backend divergence class ADR-005 exists to remove, and the reason this
// number is worth a paragraph. It needs an ultra-wide window (a spanned pair of
// 4K panels at 100% scaling reaches ~7680 CSS px) to reach, so the trade stands:
// covering that would cost +51% chevron vertices for every user. If it ever
// needs raising, `193` is the 7680px number, and the sweep above is how to
// re-derive it for another width.
//
// The three-slot gain over the previous figure is the window becoming exact:
// it used to pad a whole slot at each end (`floor(…) - 1` / `ceil(…)`) because
// it was written inline in `vs_main`, generously, to cover the chevron arms that
// the *other* backend's copy then failed to cover at all. Sharing one function
// bought both the parity and the slack back.
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
// from each shader's `.consts.generated.ts`, NOT from `passes/index.ts`: this
// module is eager (layout ← baseModel ← the plugin entry), the pass barrel
// namespace-imports the generated shader source, and a namespace import marks
// every export used — so reading one integer through the barrel would put the
// whole feature-glyph shader source in the always-loaded chunk, Canvas2D-only
// users included. The consts module carries the numbers and nothing else, which
// is what makes importing from it safe rather than merely conventional.
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
