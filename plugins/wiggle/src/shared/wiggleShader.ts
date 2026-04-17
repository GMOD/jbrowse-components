// Constants shared between the GPU renderers and TS callers. Shader source
// + per-instance layout now live in shaders/wiggle.slang → wiggle.generated.ts.
export {
  INSTANCE_STRIDE_BYTES as INSTANCE_BYTES,
  INSTANCE_STRIDE_F32 as INSTANCE_STRIDE,
  UNIFORMS_SIZE_BYTES as UNIFORM_SIZE,
  WGSL_SOURCE as wiggleShader,
} from './shaders/wiggle.generated.ts'

export const VERTICES_PER_INSTANCE = 6
export const RENDERING_TYPE_XYPLOT = 0
export const RENDERING_TYPE_DENSITY = 1
export const RENDERING_TYPE_LINE = 2
export const RENDERING_TYPE_SCATTER = 3
export const SCALE_TYPE_LINEAR = 0
export const SCALE_TYPE_LOG = 1
