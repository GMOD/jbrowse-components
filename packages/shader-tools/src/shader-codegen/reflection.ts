// One typed model of slangc's `-reflection-json` output, plus the accessors
// that dig the handful of facts out of it that the rest of the pipeline needs.
//
// It exists because there were two models. The driver declared six accessors
// with ad-hoc inline structural types (`{ parameters: { type: { kind: string,
// elementType?: { name?: string } } }[] }`, spelled out again at each one) while
// the codegen declared its own `Reflection` interface and read the same JSON
// through that. Nothing made the two agree, and they were reading the same
// fields: two of the driver's accessors and both of the codegen's walk
// `reflection.parameters` looking at `type.kind`.
//
// The types describe only the parts we consume. slangc emits considerably more
// (`containerVarLayout`, per-entry-point `bindings`, `bindlessSpaceIndex`),
// which JSON.parse keeps and TS ignores.

export interface ScalarType {
  kind: 'scalar'
  scalarType: 'float32' | 'uint32' | 'int32'
}
export interface VectorType {
  kind: 'vector'
  elementCount: number
  elementType: ScalarType
}
export type SlangType = ScalarType | VectorType

/**
 * A fixed-size array member of a uniform block.
 *
 * `uniformStride` is the std140 element stride and is NOT `sizeof(element)`:
 * std140 rounds every array element up to 16 bytes, so a `uint[9]` occupies 144
 * bytes with the value in the first word of each 16. Both backends agree on
 * that — slangc emits `array<vec4<u32>, 9>` for WGSL and leaves the GLSL member
 * inside its `layout(std140)` block — so one packed buffer feeds both, as long
 * as the TS side strides by this and not by 4.
 */
export interface ArrayType {
  kind: 'array'
  elementCount: number
  elementType: SlangType
  uniformStride: number
}

/** What a uniform-block field may be. Vertex-input fields are `SlangType`. */
export type UniformFieldType = SlangType | ArrayType

export interface UniformBinding {
  kind: 'uniform'
  offset: number
  size: number
}
export interface VaryingBinding {
  kind: 'varyingInput' | 'varyingOutput'
  index: number
}
// A resource's slot in the descriptor table. A combined `Sampler2D` reports
// `count: 2` — it consumes `index` for the texture and `index + 1` for the
// sampler.
export interface DescriptorBinding {
  kind: 'descriptorTableSlot'
  index: number
  count?: number
}

export interface Field {
  name: string
  type: UniformFieldType
  binding?: UniformBinding | VaryingBinding
  semanticName?: string
}

export interface StructType {
  kind: 'struct'
  name: string
  fields: Field[]
}

export interface ConstantBufferType {
  kind: 'constantBuffer'
  elementType: StructType
  elementVarLayout: { binding: UniformBinding }
}

export interface ResourceType {
  kind: 'resource'
  // 'texture2D' | 'structuredBuffer' | ...
  baseShape: string
  // A `Sampler2D<T>` (texture and sampler in one declaration) rather than a
  // separate `Texture2D` + `SamplerState` pair.
  combined?: boolean
  resultType?: SlangType | StructType
}

export interface Parameter {
  name: string
  binding?: DescriptorBinding
  type: ConstantBufferType | ResourceType | SlangType | StructType
}

export interface EntryPointParameter {
  name: string
  type: SlangType | StructType
  semanticName?: string
  binding?: VaryingBinding
}

export interface EntryPoint {
  name: string
  stage: 'vertex' | 'fragment' | 'compute'
  // Slang reflects `[numthreads(X, Y, Z)]` on a compute entry point.
  threadGroupSize?: [number, number, number]
  parameters: EntryPointParameter[]
  result?: {
    type?: SlangType | StructType
    binding?: VaryingBinding
    semanticName?: string
  }
}

export interface Reflection {
  parameters: Parameter[]
  entryPoints: EntryPoint[]
}

const isStruct = (t: { kind?: string }): t is StructType => t.kind === 'struct'

export function findEntryPoint(
  reflection: Reflection,
  stage: EntryPoint['stage'],
) {
  return reflection.entryPoints.find(e => e.stage === stage)
}

/**
 * The vertex entry point's struct parameter — the one whose fields carry `ATTR`
 * semantics and become the shader's vertex inputs — with the parameter's own
 * name, which is the prefix slangc mangles into the emitted GLSL attribute
 * names (`inst` -> `inst_position_0`).
 */
export function findVertexAttributeStruct(reflection: Reflection) {
  const vs = findEntryPoint(reflection, 'vertex')
  if (!vs) {
    return undefined
  }
  for (const p of vs.parameters) {
    if (isStruct(p.type)) {
      return { struct: p.type, paramName: p.name }
    }
  }
  return undefined
}

/**
 * The struct whose layout the TS side has to pack, tagged with how the shader
 * reads it.
 *
 * A `StructuredBuffer<T>` at module scope wins: that's instancing done through
 * a storage buffer, where there are no vertex inputs at all. The `struct` check
 * matters — a compute shader's `StructuredBuffer<uint>` reflects a scalar
 * `resultType`, which has no fields to pack.
 *
 * The tag is not decoration. `assertVertexInputsMatch` can only demand that the
 * emitted shader declare vertex inputs for the `attributes` case; for `buffer`
 * (and for a compute kernel, which has no struct at all) finding none is the
 * correct answer rather than a parse that silently came up empty.
 */
export function findInstanceStruct(reflection: Reflection) {
  for (const p of reflection.parameters) {
    const t = p.type
    if (
      t.kind === 'resource' &&
      t.baseShape === 'structuredBuffer' &&
      t.resultType !== undefined &&
      isStruct(t.resultType)
    ) {
      return { struct: t.resultType, source: 'buffer' as const }
    }
  }
  const attrs = findVertexAttributeStruct(reflection)
  return attrs
    ? { struct: attrs.struct, source: 'attributes' as const }
    : undefined
}

export function findConstantBuffer(reflection: Reflection) {
  for (const p of reflection.parameters) {
    if (p.type.kind === 'constantBuffer') {
      return p.type
    }
  }
  return undefined
}

/**
 * The name slangc gives the uniform block in its GLSL output, derived from the
 * reflected struct name. `vulkanGlslToWebgl2` rewrites it to the flat uniforms
 * WebGL2 wants.
 */
export function findUniformBlockName(reflection: Reflection) {
  const cb = findConstantBuffer(reflection)
  return cb ? `block_${cb.elementType.name}_0` : undefined
}

/** Names of the varyings the vertex entry point returns, in declaration order. */
export function findVaryingFieldNames(reflection: Reflection) {
  const t = findEntryPoint(reflection, 'vertex')?.result?.type
  if (t === undefined || !isStruct(t)) {
    return []
  }
  return t.fields
    .filter(f => f.binding?.kind === 'varyingOutput')
    .map(f => f.name)
}

/**
 * The fragment entry point's struct parameter name — the prefix its varying
 * reads carry, which is not the vertex side's prefix.
 */
export function findFragmentInputParamName(reflection: Reflection) {
  const fs = findEntryPoint(reflection, 'fragment')
  return fs?.parameters.find(p => isStruct(p.type))?.name
}

export interface ReflectionTexture {
  name: string
  textureBinding: number
  samplerBinding: number
}

/**
 * Combined `Sampler2D<T>` declarations. Each one consumes two WebGPU binding
 * slots (texture at N, sampler at N+1) and emits a single `sampler2D` in GLSL.
 * Returns the shader author's original name alongside both bindings so the TS
 * side can wire up `TextureBinding{textureBinding, samplerBinding,
 * glUniformName}`.
 */
export function findCombinedSamplers(reflection: Reflection) {
  const out: ReflectionTexture[] = []
  for (const p of reflection.parameters) {
    if (
      p.type.kind === 'resource' &&
      p.type.baseShape === 'texture2D' &&
      p.type.combined &&
      p.binding?.kind === 'descriptorTableSlot'
    ) {
      out.push({
        name: p.name,
        textureBinding: p.binding.index,
        samplerBinding: p.binding.index + 1,
      })
    }
  }
  return out
}
