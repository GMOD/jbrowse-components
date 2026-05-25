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
  // Emitted when the .slang source declares
  // `public static const uint VERTS_PER_INSTANCE = <expr>;` at module scope.
  // Lets slangPass() avoid taking the count as a separate argument.
  VERTS_PER_INSTANCE?: number
  // Present if the shader declares `Sampler2D<T>` bindings. The codegen
  // derives bindings from reflection so the renderer doesn't hand-maintain
  // them.
  TEXTURES?: readonly TextureBinding[]
}

export interface SlangPassOpts {
  id: string
  mod: ShaderModule
  // Optional override. Normally the count comes from the shader module's
  // VERTS_PER_INSTANCE constant (declared as a `public static const uint`
  // in the .slang source). Override only when the count is computed from a
  // TS-side runtime constant.
  verticesPerInstance?: number
  topology?: PassDescriptor['topology']
  blend?: boolean
  blendState?: BlendState
  textures?: TextureBinding[]
  wgslFragmentEntry?: string
  glslFragmentOverride?: string
  // Override if the data buffer comes from another pass (e.g. canvas's
  // chevron pass reads line's instance buffer).
  bufferStride?: number
  bufferAttributes?: readonly GlAttributeLayout[]
}

export function slangPass(opts: SlangPassOpts): PassDescriptor {
  const verticesPerInstance =
    opts.verticesPerInstance ?? opts.mod.VERTS_PER_INSTANCE
  if (verticesPerInstance === undefined) {
    throw new Error(
      `slangPass(${opts.id}): no verticesPerInstance — declare ` +
        `'public static const uint VERTS_PER_INSTANCE = N;' in the .slang ` +
        `source or pass verticesPerInstance explicitly`,
    )
  }
  return {
    id: opts.id,
    wgslSource: opts.mod.WGSL_SOURCE,
    glslVertex: opts.mod.GLSL_VERTEX,
    glslFragment: opts.mod.GLSL_FRAGMENT,
    instanceStride: opts.bufferStride ?? opts.mod.INSTANCE_STRIDE_BYTES,
    verticesPerInstance,
    blend: opts.blend ?? true,
    blendState: opts.blendState,
    glAttributes: opts.bufferAttributes ?? opts.mod.GL_ATTRIBUTES,
    topology: opts.topology,
    textures: opts.textures ?? opts.mod.TEXTURES,
    wgslFragmentEntry: opts.wgslFragmentEntry,
    glslFragmentOverride: opts.glslFragmentOverride,
  }
}
