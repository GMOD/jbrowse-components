import type {
  BlendState,
  VertexAttributeLayout,
  PipelineDescriptor,
  ShaderBinding,
  TextureBinding,
} from './hal'

// Common surface exposed by every `.generated.ts` shader module (see
// packages/shader-tools/src/shader-codegen/codegen.ts). A plugin renderer imports the module
// and passes it here — keeps pass construction a one-liner and stops stride
// / attribute layout from drifting away from the shader source.
export interface ShaderModule {
  WGSL_SOURCE: string
  GLSL_VERTEX: string
  GLSL_FRAGMENT: string
  INSTANCE_STRIDE_BYTES: number
  VERTEX_ATTRIBUTES: readonly VertexAttributeLayout[]
  // Emitted when the .slang source declares
  // `public static const uint VERTS_PER_INSTANCE = <expr>;` at module scope.
  // Lets slangPass() avoid taking the count as a separate argument.
  VERTS_PER_INSTANCE?: number
  // Present if the shader declares `Sampler2D<T>` bindings. The codegen
  // derives bindings from reflection so the renderer doesn't hand-maintain
  // them.
  TEXTURES?: readonly [TextureBinding, ...TextureBinding[]]
  // The shader's whole reflected binding table. Optional only because a pass
  // may be built from a module generated before this existed.
  BINDINGS?: readonly ShaderBinding[]
}

export interface SlangPassOpts {
  id: string
  mod: ShaderModule
  // Optional override. Normally the count comes from the shader module's
  // VERTS_PER_INSTANCE constant (declared as a `public static const uint`
  // in the .slang source). Override only when the count is computed from a
  // TS-side runtime constant.
  verticesPerInstance?: number
  topology?: PipelineDescriptor['topology']
  blend?: boolean
  blendState?: BlendState
  textures?: [TextureBinding, ...TextureBinding[]]
  wgslFragmentEntry?: string
  glslFragmentOverride?: string
  // Override if the data buffer comes from another pass (e.g. canvas's
  // chevron pass reads line's instance buffer).
  bufferStride?: number
  bufferAttributes?: readonly VertexAttributeLayout[]
}

export function slangPass(opts: SlangPassOpts): PipelineDescriptor {
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
    vertexAttributes: opts.bufferAttributes ?? opts.mod.VERTEX_ATTRIBUTES,
    topology: opts.topology,
    textures: opts.textures ?? opts.mod.TEXTURES,
    bindings: opts.mod.BINDINGS,
    wgslFragmentEntry: opts.wgslFragmentEntry,
    glslFragmentOverride: opts.glslFragmentOverride,
  }
}
