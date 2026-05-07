// Shader source + layout now live in shaders/dotplot.slang →
// dotplot.generated.ts. This file just re-exports under the historical names
// the rest of the plugin (and the shader validation test) already use.
export {
  INSTANCE_STRIDE_BYTES as INSTANCE_BYTE_SIZE,
  UNIFORMS_SIZE_BYTES as UNIFORM_BYTE_SIZE,
  WGSL_SOURCE as dotplotShader,
} from './shaders/dotplot.generated.ts'

export const VERTS_PER_INSTANCE = 6
