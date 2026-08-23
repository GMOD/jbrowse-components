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
  // Emitted from `//! topology:` / `//! blend:`. Both are properties of what the
  // stages do — topology decides what a vertex id means, blend follows from
  // whether the fragment returns premultiplied alpha — so the shader is where
  // they are stated and a pass inherits them. Optional because a shader drawn by
  // two passes at different settings declares neither; see SlangPassOpts.
  TOPOLOGY?: PipelineDescriptor['topology']
  BLEND_STATE?: BlendState
  // Present if the shader declares `Sampler2D<T>` bindings. The codegen
  // derives bindings from reflection so the renderer doesn't hand-maintain
  // them.
  TEXTURES?: readonly [TextureBinding, ...TextureBinding[]]
  // The shader's whole reflected binding table. Optional only because a pass
  // may be built from a module generated before this existed.
  BINDINGS?: readonly ShaderBinding[]
}

/**
 * What a pass is, over and above its shader: an identity, and the handful of
 * choices that are genuinely the *consumer's* rather than the shader's.
 *
 * Every remaining field is an override of something the module already carries,
 * and each one earns its place by a case in the tree where one shader is drawn
 * by two passes that disagree:
 *
 * - `verticesPerInstance` — the canvas chevron pass, whose count is the
 *   shader's `CHEVRON_VERTS` times a cap the *renderer* chooses.
 * - `blendState` / `topology` — wiggle's step line and center line share
 *   `wiggleLine.slang` and blend differently (src-over against max), so that
 *   shader declares no `//! blend:` and each pass says which it wants.
 * - `blend: false` — nothing disables blending today, which is why there is no
 *   `//! blend: none` to inherit it from.
 *
 * There is deliberately no `bufferStride` / `bufferAttributes` pair. Two passes
 * sharing one instance buffer (`drawPass(id, region, bufferPassId)`) must
 * declare the same instance struct — canvas's chevron and line both take
 * `LineInstance` from `lineInstance.slang` — so both modules reflect the same
 * stride and the same `VERTEX_ATTRIBUTES`, and copying one pass's layout onto
 * the other was restating that rather than establishing it. Worse, it *hid* the
 * case it looked like it was handling: had the two structs drifted apart, the
 * override would have made the borrowing pass read line's bytes through
 * chevron's shader without complaint. Share the `.slang` struct instead.
 */
export interface SlangPassOpts {
  id: string
  mod: ShaderModule
  verticesPerInstance?: number
  topology?: PipelineDescriptor['topology']
  blend?: boolean
  blendState?: BlendState
  textures?: [TextureBinding, ...TextureBinding[]]
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
    instanceStride: opts.mod.INSTANCE_STRIDE_BYTES,
    verticesPerInstance,
    blend: opts.blend ?? true,
    blendState: opts.blendState ?? opts.mod.BLEND_STATE,
    vertexAttributes: opts.mod.VERTEX_ATTRIBUTES,
    topology: opts.topology ?? opts.mod.TOPOLOGY,
    textures: opts.textures ?? opts.mod.TEXTURES,
    bindings: opts.mod.BINDINGS,
  }
}
