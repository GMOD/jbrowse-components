import type {
  BlendState,
  GlAttributeLayout,
  PassDescriptor,
  TextureBinding,
} from './hal'

// Common surface exposed by every `.generated.ts` shader module (see
// scripts/shader-codegen/codegen.ts). A plugin renderer imports the module
// and passes it here — keeps pass construction a one-liner and stops stride
// / attribute layout from drifting away from the shader source.
export interface ShaderModule {
  WGSL_SOURCE: string
  GLSL_VERTEX: string
  GLSL_FRAGMENT: string
  INSTANCE_STRIDE_BYTES: number
  GL_ATTRIBUTES: readonly GlAttributeLayout[]
}

export interface SlangPassOpts {
  id: string
  mod: ShaderModule
  verticesPerInstance: number
  topology?: PassDescriptor['topology']
  blend?: boolean
  blendState?: BlendState
  picking?: boolean
  textures?: TextureBinding[]
  wgslFragmentEntry?: string
  glslFragmentOverride?: string
  // Override if the data buffer comes from another pass (e.g. canvas's
  // chevron pass reads line's instance buffer).
  bufferStride?: number
  bufferAttributes?: readonly GlAttributeLayout[]
}

export function slangPass(opts: SlangPassOpts): PassDescriptor {
  return {
    id: opts.id,
    wgslSource: opts.mod.WGSL_SOURCE,
    glslVertex: opts.mod.GLSL_VERTEX,
    glslFragment: opts.mod.GLSL_FRAGMENT,
    instanceStride: opts.bufferStride ?? opts.mod.INSTANCE_STRIDE_BYTES,
    verticesPerInstance: opts.verticesPerInstance,
    blend: opts.blend ?? true,
    blendState: opts.blendState,
    glAttributes: [...(opts.bufferAttributes ?? opts.mod.GL_ATTRIBUTES)],
    vertexBuffer: true,
    topology: opts.topology,
    picking: opts.picking,
    textures: opts.textures,
    wgslFragmentEntry: opts.wgslFragmentEntry,
    glslFragmentOverride: opts.glslFragmentOverride,
  }
}
