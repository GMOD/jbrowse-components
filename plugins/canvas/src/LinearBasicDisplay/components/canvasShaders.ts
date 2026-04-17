// All canvas-feature shaders are Slang-authored (see ADR-005). Each uses
// vertex-attribute instancing via `vertexBuffer: true` on its PassDescriptor.
export { WGSL_SOURCE as ARROW_SHADER } from './shaders/arrow.generated.ts'
export { WGSL_SOURCE as CHEVRON_SHADER } from './shaders/chevron.generated.ts'
export { WGSL_SOURCE as LINE_SHADER } from './shaders/line.generated.ts'
export { WGSL_SOURCE as RECT_SHADER } from './shaders/rect.generated.ts'
