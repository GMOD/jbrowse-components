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
 *
 * That agreement is checked rather than asserted: `assertUniformLayoutMatches`
 * recomputes the block from each emitted backend's own declaration on every
 * build and fails if either disagrees with the offsets reflected here.
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
  // 'readWrite' for an `RWStructuredBuffer`; absent for a read-only one. What
  // separates a WebGPU 'storage' binding from a 'read-only-storage' one.
  access?: string
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

/**
 * Refuse a field whose type is outside the model above.
 *
 * The types in this file are a CLOSED world — three scalar types, three field
 * kinds — and slangc's JSON is an open one. TS believes every `switch` over
 * `t.kind` downstream is exhaustive, so an unmodeled shape doesn't land on a
 * `default:` anywhere; it falls through to whichever branch tested last, and
 * each one fails differently:
 *
 * - `matrix` has no `elementCount`, so it reaches the vector branch and
 *   `Array.from({ length: undefined })` makes it an EMPTY tuple. A `float4x4`
 *   uniform therefore emits `xform: []`, a `writeUniforms` that never writes it,
 *   and a single `UNIFORM_OFFSET_F32` word for a 16-word field — all of which
 *   type-check at every call site, and naga has no objection because the shader
 *   itself is valid. Silent, and it was.
 * - A nested `struct` field reaches `viewOf`, which reads `.elementType
 *   .scalarType` off it and throws a bare TypeError naming neither the field nor
 *   the shader.
 * - A scalar type that isn't one of the three (slangc really does emit
 *   `"bool"`) is absorbed by `viewOf`'s final `else` as `f32`, so an integer
 *   field gets a float view and a float write.
 *
 * One gate, one sentence. Extend the model rather than the gate when a shader
 * genuinely needs one of these — `sizeOf` (4 bytes/scalar) and `viewOf` are the
 * two places that assume the closed world hardest.
 */
const MODELED_SCALARS = new Set(['float32', 'uint32', 'int32'])

function describeType(t: { kind?: string; scalarType?: string }) {
  return t.kind === 'scalar' ? `scalar '${t.scalarType}'` : `'${t.kind}'`
}

export function assertModeledFieldType(
  where: string,
  fieldName: string,
  type: unknown,
  insideArray = false,
): void {
  const t = type as {
    kind?: string
    scalarType?: string
    elementCount?: number
    elementType?: unknown
    uniformStride?: number
  }
  const bad = (why: string): never => {
    throw new Error(
      `${where}: field '${fieldName}' is ${describeType(t)}, which the shader ` +
        `codegen does not model (${why}). It models scalars ` +
        `(${[...MODELED_SCALARS].join(', ')}), vectors of those, and — in a ` +
        `uniform block — fixed-size arrays of either. Reshape the field, or ` +
        `teach reflection.ts, codegen.ts's sizeOf/viewOf and the packers about ` +
        `the new shape together; they all assume 4-byte scalars in three views.`,
    )
  }
  if (t.kind === 'scalar') {
    if (!MODELED_SCALARS.has(t.scalarType ?? '')) {
      bad('no typed-array view corresponds to it')
    }
    return
  }
  if (t.kind === 'vector') {
    if (typeof t.elementCount !== 'number') {
      bad('it reports no elementCount')
    }
    assertModeledFieldType(where, fieldName, t.elementType, insideArray)
    return
  }
  if (t.kind === 'array') {
    if (insideArray) {
      bad('nested arrays have no offset model')
    }
    if (
      typeof t.elementCount !== 'number' ||
      typeof t.uniformStride !== 'number'
    ) {
      bad('it reports no elementCount/uniformStride')
    }
    assertModeledFieldType(where, fieldName, t.elementType, true)
    return
  }
  bad('the emitted layout and packers have no case for it')
}

/** Gate every field of a struct whose bytes the TS side has to lay out. */
export function assertModeledStruct(where: string, struct: StructType) {
  for (const f of struct.fields) {
    assertModeledFieldType(`${where} '${struct.name}'`, f.name, f.type)
  }
}

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

/**
 * The shader's uniform block, or undefined if it declares none.
 *
 * First-match, and safe only because `classifyBindings` refuses a second one
 * before any caller gets here — that is the accessor this and
 * `findCombinedSamplers` used to be, each scanning for the shape it wanted and
 * ignoring whatever else the shader declared. See bindings.ts.
 */
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
