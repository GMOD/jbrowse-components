// Shader source now lives in shaders/dotplot.slang → dotplot.generated.ts. This
// file just re-exports it under the historical name the shader validation test
// already uses.
export { WGSL_SOURCE as dotplotShader } from './shaders/dotplot.generated.ts'
