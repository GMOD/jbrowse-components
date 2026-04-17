// All canvas-feature GLSL shaders come from Slang-generated sources. Each
// pair (vertex + fragment) corresponds to its *.slang file; see ADR-005.
export {
  GLSL_FRAGMENT as ARROW_FRAGMENT_SHADER,
  GLSL_VERTEX as ARROW_VERTEX_SHADER,
} from './shaders/arrow.generated.ts'
export {
  GLSL_FRAGMENT as CHEVRON_FRAGMENT_SHADER,
  GLSL_VERTEX as CHEVRON_VERTEX_SHADER,
} from './shaders/chevron.generated.ts'
export {
  GLSL_FRAGMENT as LINE_FRAGMENT_SHADER,
  GLSL_VERTEX as LINE_VERTEX_SHADER,
} from './shaders/line.generated.ts'
export {
  GLSL_FRAGMENT as RECT_FRAGMENT_SHADER,
  GLSL_VERTEX as RECT_VERTEX_SHADER,
} from './shaders/rect.generated.ts'
