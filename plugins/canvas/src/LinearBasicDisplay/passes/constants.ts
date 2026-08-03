// The pass-library constants the *display side* needs (Canvas2D geometry, layout,
// SVG export) — pulled from the `.iface.generated.ts` modules, which hold only
// the generated integers, never the WGSL/GLSL source.
//
// That split is the whole point of this file. `passes/index.ts` namespace-imports
// the `*.generated.ts` string modules (it builds the GPU passes from them), and
// those modules `export *` their iface twin — so reading a constant through
// `passes/index.ts` drags ~67 KB of shader source along with it. The display-side
// importers are eager (`layout.ts` ← `baseModel.ts` ← the plugin entry, which
// every product's corePlugins imports at boot), so that put the whole feature-glyph
// shader source in the always-loaded chunk, including for Canvas2D users who never
// compile a shader. Import constants from here; the GPU path re-exports the same
// names through `passes/index.ts` so there is still one source per value.
export {
  MIN_DENSITY_ALPHA,
  MIN_RECT_WIDTH_PX,
} from './shaders/rect.iface.generated.ts'
export {
  CHEVRON_H_PX,
  CHEVRON_SPACING_PX,
  CHEVRON_THICKNESS_PX,
  CHEVRON_W_PX,
} from './shaders/chevron.iface.generated.ts'
export {
  ARROW_MIN_FEATURE_WIDTH_PX,
  HEAD_HALF_H_PX,
  STEM_HALF_H_PX,
  STEM_LENGTH_PX,
} from './shaders/arrow.iface.generated.ts'
export {
  CONT_EDGE_MARGIN_PX,
  CONT_MIN_OVERHANG_PX,
  CONT_TRI_GAP_PX,
  CONT_TRI_HALF_H_PX,
  CONT_TRI_W_PX,
} from './shaders/continuation.iface.generated.ts'
