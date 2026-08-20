// Generates `${base}.generated.ts` from Slang's reflection JSON plus the
// compiled WGSL / GLSL outputs. The generated file is the single source of
// truth for:
//   - WGSL / GLSL shader strings
//   - Uniform std140 layout (field offsets, total size)
//   - Per-instance vertex buffer layout (field offsets, stride)
//   - VERTEX_ATTRIBUTES descriptors (for PipelineDescriptor)
//   - Uniforms TS interface + writeUniforms() packer
//   - InstanceArrays TS interface + packInstances() struct-of-arrays packer
//
// `packInstances` takes one input array per instance field (vecN fields read N
// consecutive values per instance) and interleaves them into the vertex
// buffer. Crucially, the destination view (u32 / i32 / f32) for each field is
// derived from the shader struct, so a field-type change in .slang updates the
// packing automatically. A caller that can't use the single-array-per-field
// shape — it packs several sources into one buffer, indexes a second array, or
// scales on the way in — writes its own loop over the INSTANCE_OFFSET_* maps,
// which are split by typed-array view for the same reason: the view each field
// takes stays the shader's answer rather than the packer's.

import { assertRenderBindingShape, classifyBindings } from './bindings.ts'
import {
  assertModeledStruct,
  findConstantBuffer,
  findEntryPoint,
  findInstanceStruct,
} from './reflection.ts'

import type { BlendMode, Topology } from './parseDirectives.ts'
import type {
  ArrayType,
  Field,
  Reflection,
  ReflectionTexture,
  SlangType,
  StructType,
  UniformFieldType,
} from './reflection.ts'

export interface CodegenInputs {
  baseName: string
  reflection: Reflection
  wgsl?: string
  glslVertex?: string
  glslFragment?: string
  // Straight from `findCombinedSamplers` — the same type, not a restatement of
  // its three fields under a second name.
  textures?: ReflectionTexture[]
  vertsPerInstance?: number
  exportedConsts?: Record<string, number>
  topology?: Topology
  blend?: BlendMode
  instanceWriter?: boolean
}

// The factor pair each blend mode means, in the `BlendState` shape
// `@jbrowse/render-core/hal` declares. The mapping lives here rather than in the
// directive parser for the same reason every other TS spelling does: the parser
// says what a shader may declare, the emitter says what that becomes.
//
// `straight` is what a pass with no `blendState` already got by default, so
// declaring it changes nothing at the HAL — it is there so a shader can say the
// choice was made rather than defaulted.
const BLEND_STATE_LITERAL: Record<BlendMode, string> = {
  straight: `{ srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }`,
  premultiplied: `{ srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }`,
  max: `{ op: 'max' }`,
}

function sizeOf(t: SlangType) {
  return t.kind === 'scalar' ? 4 : t.elementCount * 4
}

// A tuple, not `number[]`, so the length is the shader's and a caller building
// a palette of the wrong size is a compile error rather than a run of zeros in
// the tail slots.
function tuple(n: number, of: string) {
  return `[${Array.from({ length: n }, () => of).join(', ')}]`
}

function tsFieldType(t: UniformFieldType): string {
  if (t.kind === 'scalar') {
    return 'number'
  }
  if (t.kind === 'array') {
    return tuple(t.elementCount, tsFieldType(t.elementType))
  }
  return tuple(t.elementCount, 'number')
}

/**
 * Refuse a uniform array of SCALARS, which slangc v2026.5.2 cannot compile for
 * WebGPU and does not say so.
 *
 * A `uint palette[N]` member becomes a `_Array_std140_uintN` wrapper struct
 * (std140 pads each element to 16 bytes), and passing an element of one to a
 * cross-module function SEGFAULTS slangc — signal 11, no diagnostic, and the
 * driver can only report that the compiler died. `[ForceInline]` on the callee
 * dodges the crash and then emits invalid WGSL (a bare `…data_0[i].x;`
 * statement), so there is no spelling that works. GLSL compiles it fine, which
 * is what makes it easy to hit and hard to attribute.
 *
 * The fix is always the same, so name it here rather than making someone
 * bisect a segfault: declare the array as `float4[N]`. A vector element needs no
 * wrapper, lowers correctly, and occupies the same 16 bytes std140 was padding
 * the scalar to — so packing bought nothing in a uniform array anyway. (It buys
 * plenty in a vertex attribute, which is unaffected: those can't be arrays.)
 */
function assertNoScalarArray(baseName: string, field: Field, type: ArrayType) {
  if (type.elementType.kind === 'scalar') {
    throw new Error(
      `${baseName}.slang: uniform field '${field.name}' is an array of ` +
        `${type.elementType.scalarType}, which slangc cannot compile for WGSL ` +
        `(it segfaults with no diagnostic). Declare it as float4[` +
        `${type.elementCount}] — std140 pads each element to 16 bytes either ` +
        `way, so a vector element costs the same and lowers correctly.`,
    )
  }
}

// Word offsets of an array field's elements. Element `i` lives `uniformStride`
// bytes after element `i-1`, NOT `sizeof(element)` — see ArrayType.
function arrayElementWords(field: Field, type: ArrayType) {
  if (field.binding?.kind !== 'uniform') {
    return []
  }
  const base = field.binding.offset / 4
  const strideWords = type.uniformStride / 4
  return Array.from(
    { length: type.elementCount },
    (_, i) => base + i * strideWords,
  )
}

// Which typed-array view addresses a field of this type. ONE mapping from the
// Slang scalar type to the JS view: the emitted uniform offset maps, the
// `writeUniforms` writes, the `packInstances` writes and the VERTEX_ATTRIBUTES
// component type all read it, and they were four separate spellings of the
// same three-way branch.
//
// `VIEWS` is the emission order as well as the set, so every per-view block a
// generated module carries appears in the same order. The uniform offset maps
// spelled their own `['f32', 'i32', 'u32'] as const` and so emitted `_I32`
// before `_U32` while the instance maps two screens down emitted `_U32` first —
// a second copy of the list, disagreeing, in the file whose comment says there
// is one.
type View = 'f32' | 'u32' | 'i32'
const VIEWS: readonly View[] = ['f32', 'u32', 'i32']
const VIEW_ARRAY: Record<View, string> = {
  f32: 'Float32Array',
  u32: 'Uint32Array',
  i32: 'Int32Array',
}
const VIEW_COMPONENT: Record<View, 'float' | 'uint' | 'int'> = {
  f32: 'float',
  u32: 'uint',
  i32: 'int',
}
function viewOf(t: UniformFieldType): View {
  if (t.kind === 'array') {
    return viewOf(t.elementType)
  }
  const s = t.kind === 'scalar' ? t.scalarType : t.elementType.scalarType
  if (s === 'uint32') {
    return 'u32'
  }
  return s === 'int32' ? 'i32' : 'f32'
}

// `const f32 = new Float32Array(buf)` for each view the body goes on to use,
// always in VIEWS order. Both packers take their buffer in a parameter named
// `buf`, so this is the same three lines in both.
function declareViews(used: ReadonlySet<View>) {
  return VIEWS.filter(v => used.has(v)).map(
    v => `  const ${v} = new ${VIEW_ARRAY[v]}(buf)`,
  )
}

function toStringLiteral(s: string) {
  return JSON.stringify(s)
}

// The per-instance vertex buffer layout: fields in declaration order, packed
// tight (every Slang scalar/vector field is a multiple of 4 bytes, which is
// also the alignment both backends require of a vertex attribute).
//
// This is the codegen's own model of the layout, NOT something slangc reflects
// — reflection gives byte offsets for uniform blocks, not for vertex-input
// structs. `assertVertexInputsMatch` checks the model against the shader code
// slangc actually emitted, so the two can't silently disagree.
export interface InstanceAttr {
  name: string
  offsetBytes: number
  size: number
  type: SlangType
}

/**
 * Refuse a storage-buffer instance struct whose tight layout is not the one the
 * GPU would read.
 *
 * Tight packing is right for a VERTEX ATTRIBUTE — both backends require only
 * 4-byte alignment there, and a `float3` at offset 4 is legal. It is not the
 * rule for a struct in a storage buffer: std430 (and WGSL's default layout,
 * which agrees) aligns a vec2 to 8 and a vec3/vec4 to 16, and rounds the struct
 * stride up to its largest member's alignment. `float2 a; float b; float2 c;`
 * packs c at 12 here and the GPU reads it at 16.
 *
 * This matters because it is the one shape nothing else catches.
 * `assertVertexInputsMatch` is what keeps the tight model honest for the
 * attributes case, and it can say nothing here by construction: a
 * storage-buffer shader declares no vertex inputs, so there is nothing to
 * compare against and finding nothing is the correct answer. Every field would
 * simply be packed to an offset the shader does not read — silently, on both
 * backends.
 *
 * No shader in the tree instances through a storage buffer today (they all use
 * `StructuredBuffer<uint>`/`<float>`, whose scalar element `findInstanceStruct`
 * declines). So this refuses rather than implementing std430 offsets: an
 * untested layout emitter for a case with no consumer is a worse answer than a
 * build error that names the rule for whoever writes the first one.
 */
function assertTightLayoutIsReadable(
  structName: string,
  attrs: readonly InstanceAttr[],
) {
  for (const a of attrs) {
    const align =
      a.type.kind === 'scalar' ? 4 : a.type.elementCount === 2 ? 8 : 16
    if (a.offsetBytes % align !== 0) {
      throw new Error(
        `instance struct '${structName}' comes from a StructuredBuffer, where ` +
          `std430 aligns field '${a.name}' to ${align} bytes — but the ` +
          `codegen packs it tight, at offset ${a.offsetBytes}. Reorder the ` +
          `struct so each vector field lands on its own alignment (widest ` +
          `first is always safe), or pad it explicitly. Vertex-attribute ` +
          `instancing is unaffected: 4-byte alignment is all either backend ` +
          `asks there.`,
      )
    }
  }
}

// `source` is required rather than defaulted, so a new call site has to say
// which layout rule applies instead of inheriting the laxer one by omission.
function instanceAttrs(
  vs: StructType,
  source: 'attributes' | 'buffer',
): InstanceAttr[] {
  assertModeledStruct('instance struct', vs)
  let cursor = 0
  const attrs = vs.fields.map(f => {
    // A vertex attribute can't be an array — there is no `@location` form for
    // one, and the tight-packed stride below has no answer for std140's element
    // padding. Refuse rather than pack something neither backend would read.
    if (f.type.kind === 'array') {
      throw new Error(
        `instance struct '${vs.name}' field '${f.name}' is an array; ` +
          `vertex attributes must be scalars or vectors. Pass it as a uniform, ` +
          `or as separate fields.`,
      )
    }
    const type: SlangType = f.type
    const entry = {
      name: f.name,
      offsetBytes: cursor,
      size: sizeOf(type),
      type,
    }
    cursor += sizeOf(type)
    return entry
  })
  if (source === 'buffer') {
    assertTightLayoutIsReadable(vs.name, attrs)
  }
  return attrs
}
// The instance layout for a whole reflection, or undefined for a shader with no
// instance struct (compute kernels). The driver's build-time cross-check reads
// the same list `emitInterface` emits from, and the tag tells it whether the
// shader is supposed to declare vertex inputs at all.
export function instanceAttrsFor(reflection: Reflection) {
  const vs = findInstanceStruct(reflection)
  return vs
    ? { attrs: instanceAttrs(vs.struct, vs.source), source: vs.source }
    : undefined
}
// The uniform block's reflected layout, in the shape `assertUniformLayoutMatches`
// checks the emitted shaders against. Built from the same `binding.offset` /
// `uniformStride` that `UNIFORM_OFFSET_*`, `UNIFORM_SLOT_ARRAYS` and
// `writeUniforms` are emitted from below, deliberately: the point is to pin the
// numbers that ship, not to recompute a second opinion of them here and check
// that against a third.
export function uniformFieldsFor(reflection: Reflection) {
  const cb = findConstantBuffer(reflection)
  if (!cb) {
    return undefined
  }
  return {
    structName: cb.elementType.name,
    totalBytes: cb.elementVarLayout.binding.size,
    fields: cb.elementType.fields.flatMap(f =>
      f.binding?.kind === 'uniform'
        ? [
            {
              name: f.name,
              offsetBytes: f.binding.offset,
              strideBytes:
                f.type.kind === 'array' ? f.type.uniformStride : undefined,
              elementCount:
                f.type.kind === 'array' ? f.type.elementCount : undefined,
              view: viewOf(f.type),
            },
          ]
        : [],
    ),
  }
}

export function instanceStride(attrs: InstanceAttr[]) {
  const last = attrs.at(-1)
  return last ? last.offsetBytes + last.size : 0
}

// The stride and per-field word offsets, emitted identically by `emitInterface`
// and by the layout-only module `//! layout-out` writes.
//
// **One suffix, one meaning.** `_BYTES` and `_WORDS` are units; `_F32` / `_U32`
// / `_I32` are typed-array views, the sense they already had in
// `UNIFORM_OFFSET_*`. That was not true until recently: the instance side
// emitted a single flat `FIELD_OFFSET_F32` over every field regardless of type,
// where `_F32` meant *4-byte words* — so two adjacent generated constants used
// the same suffix for opposite things, and packing through the flat map meant
// choosing the destination view by hand. `f32[o + F.position]` on a `uint
// position` compiled and wrote a float bit pattern the shader read as an
// enormous integer. ~140 call sites did this correctly and nothing checked
// them.
//
// `INSTANCE_OFFSET_*` holds only the fields whose Slang type takes that view, so
// `INSTANCE_OFFSET_F32.position` on a `uint position` does not compile. The flat
// map is gone rather than deprecated: leaving it would have left the ambiguous
// suffix in the vocabulary and a second, unchecked way to do the same thing.
function instanceLayoutLines(attrs: InstanceAttr[]) {
  const stride = instanceStride(attrs)
  const lines = [
    // #shaderExport INSTANCE_STRIDE_BYTES | bytes per instance in the packed buffer
    `export const INSTANCE_STRIDE_BYTES = ${stride}`,
    // #shaderExport INSTANCE_STRIDE_WORDS | the same stride in 4-byte words
    `export const INSTANCE_STRIDE_WORDS = ${stride / 4}`,
    '',
  ]
  for (const view of VIEWS) {
    const fields = attrs.filter(a => viewOf(a.type) === view)
    if (fields.length === 0) {
      continue
    }
    lines.push(
      `// Word indices into a ${VIEW_ARRAY[view]} view over the instance buffer.`,
      // #shaderExport INSTANCE_OFFSET_F32 / _U32 / _I32 | per-field word indices, one map per typed-array view; only the views the instance fields actually use are emitted
      `export const INSTANCE_OFFSET_${view.toUpperCase()} = {`,
      ...fields.map(a => `  ${a.name}: ${a.offsetBytes / 4},`),
      '} as const',
      '',
    )
  }
  return lines
}

// Struct-of-arrays instance packer. Takes one input array per field (vecN
// fields read N consecutive values per instance) and interleaves them into the
// vertex buffer. The destination view (u32 / i32 / f32) for each field is
// derived from the shader struct here, so changing a field's type in the
// .slang source updates the packing automatically — the hand-written interleave
// functions this replaces chose the view by hand and could silently drift from
// the shader.
function instancePackerLines(attrs: InstanceAttr[]) {
  const lines = [
    // #shaderExport InstanceArrays | one input array per instance field, the argument `packInstances` takes
    'export interface InstanceArrays {',
    ...attrs.map(a => `  ${a.name}: ArrayLike<number>`),
    '}',
    '',
    // `numInstances` (not `count`) avoids colliding with an instance field
    // literally named `count` — the destructure below binds field names as
    // locals, so the loop bound must not share a name with any field. Every
    // other such name is in INSTANCE_EMIT_RESERVED, checked by the caller.
    // #shaderExport packInstances | interleaves parallel arrays into one instance buffer
    'export function packInstances(',
    '  arrays: InstanceArrays,',
    '  numInstances: number,',
    '  buf: ArrayBuffer = new ArrayBuffer(numInstances * INSTANCE_STRIDE_BYTES),',
    ') {',
    ...declareViews(new Set(attrs.map(a => viewOf(a.type)))),
    `  const { ${attrs.map(a => a.name).join(', ')} } = arrays`,
    '  for (let i = 0; i < numInstances; i++) {',
    '    const o = i * INSTANCE_STRIDE_WORDS',
  ]
  for (const a of attrs) {
    const view = viewOf(a.type)
    const word = a.offsetBytes / 4
    const comps = a.type.kind === 'scalar' ? 1 : a.type.elementCount
    if (comps === 1) {
      lines.push(`    ${view}[o + ${word}] = ${a.name}[i]!`)
    } else {
      for (let c = 0; c < comps; c++) {
        lines.push(
          `    ${view}[o + ${word + c}] = ${a.name}[i * ${comps} + ${c}]!`,
        )
      }
    }
  }
  lines.push('  }', '  return buf', '}', '')
  return lines
}

/**
 * Per-field get/set over a packed instance buffer.
 *
 * `packInstances` covers the bulk case — parallel arrays in, one interleaved
 * buffer out — but not the two that read or write the buffer an instance at a
 * time: a worker projecting a result straight into the vertex layout, and the
 * Canvas2D/SVG fallback iterating the same buffer the GPU draws from. Those
 * sites otherwise spell `f32[i * INSTANCE_STRIDE_WORDS + INSTANCE_OFFSET_F32.x]`
 * inline, which is the hand-rolled interleave `packInstances` exists to delete,
 * written per access instead of per buffer.
 *
 * The view is bound to the field here, same as in the packer, so a `.slang`
 * field that changes type moves its accessor's parameter type and fails to
 * compile at the call site — rather than reinterpreting the bits, which is
 * exactly what the flat `FIELD_OFFSET_F32` map described above did.
 *
 * Deliberately one function per field rather than a whole-instance struct
 * reader: a struct reader allocates, and these run in loops over 10^5-10^6
 * instances. A one-line typed-array index is what V8 inlines.
 */
function instanceAccessorLines(attrs: InstanceAttr[]) {
  const lines: string[] = []
  for (const a of attrs) {
    const view = viewOf(a.type)
    const array = VIEW_ARRAY[view]
    const word = a.offsetBytes / 4
    const comps = a.type.kind === 'scalar' ? 1 : a.type.elementCount
    const Name = a.name.charAt(0).toUpperCase() + a.name.slice(1)
    const at =
      word === 0
        ? 'i * INSTANCE_STRIDE_WORDS'
        : `i * INSTANCE_STRIDE_WORDS + ${word}`
    if (comps === 1) {
      lines.push(
        `// Instance \`i\`'s \`${a.name}\`.`,
        // #shaderExport getInstance<Field> | reads one instance field out of a packed buffer, through that field's own typed view
        `export function getInstance${Name}(${view}: ${array}, i: number) {`,
        `  return ${view}[${at}]!`,
        '}',
        '',
        // #shaderExport setInstance<Field> | writes one instance field into a packed buffer, through that field's own typed view
        `export function setInstance${Name}(${view}: ${array}, i: number, v: number) {`,
        `  ${view}[${at}] = v`,
        '}',
        '',
      )
    } else {
      lines.push(
        `// Component \`c\` of instance \`i\`'s \`${a.name}\` (${comps} components).`,
        // #shaderExport getInstance<Field> (vector field) | reads one component of a vector instance field; takes a component index
        `export function getInstance${Name}(${view}: ${array}, i: number, c: number) {`,
        `  return ${view}[${at} + c]!`,
        '}',
        '',
        // #shaderExport setInstance<Field> (vector field) | writes a whole vector instance field; takes one value per component
        `export function setInstance${Name}(`,
        `  ${view}: ${array},`,
        '  i: number,',
        ...Array.from({ length: comps }, (_, c) => `  v${c}: number,`),
        ') {',
        `  const o = ${at}`,
        ...Array.from(
          { length: comps },
          (_, c) => `  ${view}[o${c === 0 ? '' : ` + ${c}`}] = v${c}`,
        ),
        '}',
        '',
      )
    }
  }
  return lines
}

/**
 * Per-element set over an array-valued uniform slot.
 *
 * `UNIFORM_SLOT_ARRAYS` gives a caller the word offset of element `i` — which is
 * the part std140 makes non-obvious, since elements stride by 16 bytes and not
 * by their own size — and then stops, leaving the component stores to be written
 * out at every site that fills a palette. Two sites in the alignments renderer
 * did that, spelling the same four assignments, and the instance side had
 * already closed exactly this gap with `setInstance<Field>`.
 *
 * **Every component is a parameter, and that is the point rather than a
 * convenience.** A uniform slot nobody writes keeps whatever the previous
 * render left in it, so a half-written element is a stale value rather than a
 * zero — and the lane this happens to is alpha, because the shaders read `.xyz`
 * and set their own, which makes the fourth store look optional at the call
 * site. Taking it as a parameter means it cannot be omitted.
 *
 * No matching getter: nothing in the tree reads a palette slot back, and the
 * instance side emits one only because the hic hit test does.
 */
function uniformArraySetterLines(
  fields: readonly {
    name: string
    words: number[]
    type: ArrayType
    view: View
  }[],
) {
  const lines: string[] = []
  for (const a of fields) {
    // `assertNoScalarArray` has already refused a scalar element, so this is a
    // vector and `elementCount` is its component count.
    const comps =
      a.type.elementType.kind === 'scalar' ? 1 : a.type.elementType.elementCount
    const array = VIEW_ARRAY[a.view]
    const Name = a.name.charAt(0).toUpperCase() + a.name.slice(1)
    lines.push(
      `// Element \`i\` of the \`${a.name}\` uniform array (${comps} components).`,
      // #shaderExport setUniform<Field> | writes one element of an array-valued uniform slot, through that field's own typed view; takes every component so an element cannot be half-written
      `export function setUniform${Name}(`,
      `  ${a.view}: ${array},`,
      '  i: number,',
      ...Array.from({ length: comps }, (_, c) => `  v${c}: number,`),
      ') {',
      `  const o = UNIFORM_SLOT_ARRAYS.${a.name}[i]!`,
      ...Array.from(
        { length: comps },
        (_, c) => `  ${a.view}[o${c === 0 ? '' : ` + ${c}`}] = v${c}`,
      ),
      '}',
      '',
    )
  }
  return lines
}

// Names the instance emitters bind in their own scope, either as a
// parameter/local or (for the two stride constants they reference) at module
// scope. An instance field sharing one of them is shadowed by the binding:
// `count` was caught and renamed around, but a field named `o` or `i` would
// silently pack NaN, since the loop bindings win over the destructured array and
// `o[i]` is a number. Fail at emit time instead, where the message can name the
// field.
//
// One set for `packInstances`, the per-field accessors and `InstanceWriter`,
// because the consequence is the same shape and a second list would drift: the
// accessors bind `c` (component index) and `v`/`v0…` (the values written), and a
// field named `v0` would compile to `f32[o] = v0` reading its own parameter.
//
// `count` is deliberately NOT here. The writer's own count is `this.count`, so a
// field named `count` — hic has one — is only ever a parameter, and `packInstances`
// avoids the collision by calling its loop bound `numInstances`.
const INSTANCE_EMIT_RESERVED = new Set([
  'arrays',
  'numInstances',
  'buf',
  'i',
  'o',
  'c',
  'v',
  // one per component of the widest vector a Slang instance field can be
  'v0',
  'v1',
  'v2',
  'v3',
  // the writer's one local that is not `this.`-qualified
  'grown',
  ...VIEWS,
  'INSTANCE_STRIDE_BYTES',
  'INSTANCE_STRIDE_WORDS',
])

// Checked by both emitters that write instance code, since `//! layout-out`
// now emits the packer and the accessors too — a shader reaching only the
// layout-only path would otherwise generate the shadowed code unchecked.
function assertNoReservedInstanceNames(
  baseName: string,
  attrs: readonly InstanceAttr[],
) {
  const collision = attrs.find(a => INSTANCE_EMIT_RESERVED.has(a.name))
  if (collision) {
    throw new Error(
      `${baseName}.slang: instance field '${collision.name}' collides with a ` +
        `name the generated instance code binds in its own scope ` +
        `(${[...INSTANCE_EMIT_RESERVED].join(', ')}). packInstances() ` +
        `destructures every field as a local and the per-field accessors bind ` +
        `their index and value parameters, so this one would be shadowed and ` +
        `read or write garbage. Rename the field in the .slang struct.`,
    )
  }
}

// One `push` parameter per COMPONENT: a scalar field contributes its own name, a
// vecN field contributes `<name>0…<name>N-1`. Positional rather than an options
// object because the writer's whole reason to exist is a loop over 10^5-10^6
// instances on the main thread, and an object per push is an allocation per
// instance — which is exactly the two-pass shape maf measured at ~3x slower and
// wrote this machinery by hand to avoid.
function writerParams(attrs: readonly InstanceAttr[]) {
  const params = attrs.flatMap(a =>
    a.type.kind === 'scalar'
      ? [{ name: a.name, attr: a, component: 0 }]
      : Array.from({ length: a.type.elementCount }, (_, c) => ({
          name: `${a.name}${c}`,
          attr: a,
          component: c,
        })),
  )
  // A scalar field named `position0` alongside a `float2 position` would give
  // two parameters one name, and the second would silently win for both lanes.
  const seen = new Set<string>()
  for (const p of params) {
    if (seen.has(p.name)) {
      throw new Error(
        `instance fields collide in the generated InstanceWriter: two push ` +
          `parameters would be named '${p.name}'. A vecN field contributes ` +
          `'<name>0'…, so a scalar field of that name cannot also exist. ` +
          `Rename one in the .slang struct.`,
      )
    }
    seen.add(p.name)
  }
  return params
}

/**
 * An append-at-a-time writer over the packed instance layout.
 *
 * `packInstances` covers the case where the caller has one flat array per field
 * and knows the instance count up front. Two encoders in the tree have neither:
 * maf merges runs of same-coloured cells so the count is not known until the
 * walk ends, and multi-row features skips whatever a hidden legend category
 * filters out. Both had written this class by hand against their own shader's
 * offsets — maf's spelled `push(startBp, endBp, rowIndex, color)` with the four
 * stores listed out — and both re-derived `count * INSTANCE_STRIDE_WORDS` and
 * chose each field's typed-array view themselves.
 *
 * **Reach for it where an append is already happening, not for a plain indexed
 * loop.** Two benches, both to the shape `agent-docs/reference/BENCHMARKING.md`
 * asks for — separate drivers per arm, a control arm, min of interleaved
 * rounds, identity checked before timing — over 100k/500k/2M:
 *
 * - `plugins/canvas/benches/instanceWriter.bench.ts`, against multi-row's
 *   previous form (an append inside a callback bumping a counter captured in a
 *   closure): the writer is **0.86-0.96x, i.e. faster**, because V8 heap-
 *   allocates a mutated closure variable and a field on a monomorphic object
 *   beats it.
 * - `plugins/linear-comparative-view/benches/instanceWriter.bench.ts`, against
 *   synteny's previous form (a plain `for` over a known count with both views
 *   hoisted): the writer is **1.5x to 2.3x SLOWER**, and synteny keeps its raw
 *   loop for that reason.
 *
 * The writer costs a call, a growth branch and a `this.count` round trip per
 * instance; an append pays that anyway and an indexed loop does not.
 *
 * Don't quote either number without the other, and don't quote the first
 * version of them: it used one shared `time(fn, …)` driver for both arms, which
 * is the catalogue's first trap verbatim, and reported 1.15x/1.92x/1.50x — a
 * non-monotonic set that was understating a real ~2.3x. The control arm is what
 * caught it.
 *
 * Two things the hand-written copies did not generalize. The views come from the
 * shader, so a struct mixing `float` and `uint` fields gets both arrays over one
 * buffer and both are rebuilt on growth — maf's copy assumed every field was
 * `u32`, which was true of maf's struct and of nothing else. And `finish`
 * right-sizes with a copy rather than a subarray view, because these payloads are
 * retained per region for as long as the region is loaded and a view would pin
 * the whole over-allocation (the rule in `packages/render-core/CLAUDE.md`).
 *
 * `finish` returns the buffer alone. The instance count is `writer.count`, and
 * `uploadPass` takes it off `byteLength / stride` — returning a `{buffer, count}`
 * pair here would be the "second expression" that rule exists to prevent.
 */
function instanceWriterLines(attrs: readonly InstanceAttr[]) {
  const params = writerParams(attrs)
  const used = new Set(attrs.map(a => viewOf(a.type)))
  const views = VIEWS.filter(v => used.has(v))
  const lines = [
    '// Appends instances one at a time, for an encoder that cannot say up front',
    '// how many it will emit. Seed the constructor with an upper bound and the',
    '// common path allocates exactly once; the doubling is a correctness',
    '// backstop, not the expected route.',
    // #shaderExport InstanceWriter | append-at-a-time writer over the packed instance layout, for an encoder whose instance count is not known up front
    'export class InstanceWriter {',
    '  private buf: ArrayBuffer',
    ...views.map(v => `  private ${v}: ${VIEW_ARRAY[v]}`),
    '  private capacity: number',
    '  count = 0',
    '',
    '  constructor(capacity: number) {',
    '    this.capacity = Math.max(1, capacity)',
    '    this.buf = new ArrayBuffer(this.capacity * INSTANCE_STRIDE_BYTES)',
    ...views.map(v => `    this.${v} = new ${VIEW_ARRAY[v]}(this.buf)`),
    '  }',
    '',
    `  push(${params.map(p => `${p.name}: number`).join(', ')}) {`,
    '    if (this.count === this.capacity) {',
    '      this.capacity *= 2',
    '      const grown = new ArrayBuffer(this.capacity * INSTANCE_STRIDE_BYTES)',
    '      new Uint8Array(grown).set(new Uint8Array(this.buf))',
    '      this.buf = grown',
    ...views.map(v => `      this.${v} = new ${VIEW_ARRAY[v]}(grown)`),
    '    }',
    '    const o = this.count * INSTANCE_STRIDE_WORDS',
  ]
  for (const p of params) {
    const view = viewOf(p.attr.type)
    const word = p.attr.offsetBytes / 4 + p.component
    lines.push(
      `    this.${view}[o${word === 0 ? '' : ` + ${word}`}] = ${p.name}`,
    )
  }
  lines.push(
    '    this.count++',
    '  }',
    '',
    '  // A right-sized COPY, not a subarray view — see the class comment. Skipped',
    '  // entirely when the seed turned out to be exact, which is the common path.',
    '  finish() {',
    '    const used = this.count * INSTANCE_STRIDE_BYTES',
    '    return used === this.buf.byteLength ? this.buf : this.buf.slice(0, used)',
    '  }',
    '}',
    '',
  )
  return lines
}

// The provenance banner every generated artifact opens with. Exported because
// the JS twins carry it too, and `writeJsExports` was re-typing these two lines
// rather than sharing them — so a change here reached every generated file
// except the twins.
export const header = (baseName: string) => [
  `// AUTO-GENERATED by packages/shader-tools/src/shader-codegen from ${baseName}.slang.`,
  '// Do not edit. Run `pnpm gen:shaders` to regenerate.',
  '',
]

/**
 * The heavy WGSL / GLSL shader strings, and the top of the re-export chain.
 *
 * One shader emits up to three modules — strings here, shape in
 * `${base}.iface.generated.ts`, `//! export-consts` values in
 * `${base}.consts.generated.ts` — and the split is about the BUNDLER, not about
 * tidiness. A render path imports the whole surface as a namespace
 * (`import * as readShader`), which marks every export used, so a module is
 * included or excluded whole: whatever the smallest eager consumer of a module
 * wants, the eager chunk pays for all of it.
 *
 * That is measured, not reasoned. Three eager modules in plugins/alignments
 * (`constants.ts`, `colorUtils.ts`, `renderers/rendererTypes.ts`) import only
 * `CS_*` / `RC_*` / one pixel threshold, and were holding all 16 KB of
 * `read.iface.generated.ts` — `writeUniforms` and the packers included — in the
 * always-loaded chunk. `pnpm probe-eager-graph --holds` in the byo examples site
 * is the tool that says so, and the eager-bundle backlog entry in
 * agent-docs/TODO.md is where the number came from.
 *
 * So: a consumer imports from the SMALLEST module carrying what it wants. Every
 * one of the 33 sites that imports an export-const wanted nothing else from the
 * module it was importing from, which is what made the constants the right seam.
 * The re-export chain runs one way only — strings re-export shape and consts, so
 * an existing `import * as xShader` from `${base}.generated.ts` still sees the
 * full `ShaderModule` surface — and never back up it.
 */
export function emitShaderStrings(inputs: CodegenInputs) {
  const { baseName, wgsl, glslVertex, glslFragment, exportedConsts } = inputs
  const lines = header(baseName)
  if (wgsl !== undefined) {
    // #shaderExport WGSL_SOURCE | the compiled WGSL, when the shader targets wgsl
    lines.push(`export const WGSL_SOURCE = ${toStringLiteral(wgsl)}`, '')
  }
  if (glslVertex !== undefined) {
    // #shaderExport GLSL_VERTEX | the compiled WebGL2 vertex stage
    lines.push(`export const GLSL_VERTEX = ${toStringLiteral(glslVertex)}`, '')
  }
  if (glslFragment !== undefined) {
    // #shaderExport GLSL_FRAGMENT | the compiled WebGL2 fragment stage
    lines.push(
      `export const GLSL_FRAGMENT = ${toStringLiteral(glslFragment)}`,
      '',
    )
  }
  lines.push(`export * from './${baseName}.iface.generated.ts'`, '')
  if (exportedConsts) {
    lines.push(`export * from './${baseName}.consts.generated.ts'`, '')
  }
  return lines.join('\n')
}

// The uniform/instance layout, the typed packers, VERTEX_ATTRIBUTES, textures —
// everything derived from the shader's *shape*. Neither the shader strings
// (`emitShaderStrings`) nor the `//! export-consts` values (`emitConsts`) are
// here; each of the three is its own module because each has its own set of
// consumers, and a namespace import of any one of them defeats tree-shaking for
// everything that module carries. See emitShaderStrings for the measured case.
export function emitInterface(inputs: CodegenInputs) {
  const {
    baseName,
    reflection,
    textures,
    vertsPerInstance,
    topology,
    blend,
    instanceWriter,
  } = inputs
  const lines = header(baseName)

  // Classify the whole parameter list before anything reads a piece of it: this
  // is what refuses a second uniform block (silently dropped until now), a
  // duplicate binding index, and a resource shape nothing could bind. See
  // bindings.ts.
  const bindings = classifyBindings(`${baseName}.slang`, reflection)

  // Import only the HAL types the emitted module actually references. A compute
  // shader has no instance attributes and no textures, so it imports neither.
  const vs = findInstanceStruct(reflection)
  const halImports = vs ? ['VertexAttributeLayout'] : []
  if (bindings.length > 0) {
    halImports.push('ShaderBinding')
  }
  if (blend !== undefined) {
    halImports.push('BlendState')
  }
  if (textures && textures.length > 0) {
    halImports.push('TextureBinding')
  }
  if (halImports.length > 0) {
    lines.push(
      `import type { ${halImports.join(', ')} } from '@jbrowse/render-core/hal'`,
      '',
    )
  }

  // The shader's own binding table, so a consumer builds its bind group layout
  // from the shader instead of restating it. Three places restated it — both
  // HALs' hardcoded render layouts and the LD compute driver's — and reflection
  // knew the answer in all three.
  //
  // A render shader is additionally held to a shape the HALs actually bind; a
  // compute shader is not, because its driver derives the layout from this.
  if (bindings.length > 0) {
    if (findEntryPoint(reflection, 'vertex')) {
      assertRenderBindingShape(`${baseName}.slang`, bindings)
    }
    // #shaderExport BINDINGS | every binding the shader declares, for HAL bind-group setup
    lines.push('export const BINDINGS: readonly ShaderBinding[] = [')
    for (const b of bindings) {
      lines.push(
        `  { index: ${b.index}, kind: '${b.kind}', name: '${b.name}' },`,
      )
    }
    lines.push(']', '')
  }

  if (vertsPerInstance !== undefined) {
    // #shaderExport VERTS_PER_INSTANCE | vertices per instance, from the shader's const of that name; the draw call reads it
    lines.push(`export const VERTS_PER_INSTANCE = ${vertsPerInstance}`, '')
  }

  // Pipeline state that follows from the stages, from `//! topology:` and
  // `//! blend:`. Both are defaults a pass may override — see parseDirectives.
  //
  // Refused on a shader with no vertex stage rather than emitted and ignored: a
  // compute kernel is dispatched, not drawn, so neither has any meaning there
  // and a directive on one is a misunderstanding worth naming.
  if (instanceWriter && !vs) {
    throw new Error(
      `${baseName}.slang declares //! instance-writer but reflects no instance ` +
        `struct, so there is no layout to append to. The directive belongs on a ` +
        `shader whose vertex inputs (or StructuredBuffer element) are the record ` +
        `an encoder packs.`,
    )
  }
  if ((topology !== undefined || blend !== undefined) && !vs) {
    throw new Error(
      `${baseName}.slang declares //! ${topology !== undefined ? 'topology' : 'blend'} ` +
        `but has no vertex stage. Both describe how a draw rasterizes, and a ` +
        `compute kernel is dispatched rather than drawn — there is no pipeline ` +
        `for either to configure.`,
    )
  }
  if (topology !== undefined) {
    // #shaderExport TOPOLOGY | the primitive topology `vs_main` emits for, when the shader declares one
    lines.push(`export const TOPOLOGY = '${topology}' as const`, '')
  }
  if (blend !== undefined) {
    // #shaderExport BLEND_STATE | the blend the fragment stage's output wants, when the shader declares one
    lines.push(
      `export const BLEND_STATE: BlendState = ${BLEND_STATE_LITERAL[blend]}`,
      '',
    )
  }

  // Compute entry point + its [numthreads] X dimension. Both come from the
  // shader's own declaration, so the dispatch count a TS caller computes
  // (ceil(work / WORKGROUP_SIZE_X)) can't drift from the workgroup the kernel
  // actually declares, and the entry-point name can't drift from the function.
  const cs = reflection.entryPoints.find(e => e.stage === 'compute')
  if (cs) {
    lines.push(
      // #shaderExport COMPUTE_ENTRY_POINT | the compute entry point name, for a compute shader
      `export const COMPUTE_ENTRY_POINT = ${toStringLiteral(cs.name)}`,
      '',
    )
    if (cs.threadGroupSize) {
      // #shaderExport WORKGROUP_SIZE_X | the compute workgroup width
      lines.push(`export const WORKGROUP_SIZE_X = ${cs.threadGroupSize[0]}`, '')
    }
  }

  const cb = findConstantBuffer(reflection)
  if (cb) {
    const u = cb.elementType
    // Before any offset is read off it: every branch below assumes the closed
    // three-scalar / three-kind model, and a shape outside it fails silently
    // rather than loudly. See assertModeledFieldType.
    assertModeledStruct(`${baseName}.slang uniform block`, u)
    const totalBytes = cb.elementVarLayout.binding.size
    // #shaderExport UNIFORMS_SIZE_BYTES | size of the uniform block, the `uniformByteSize` a backend passes
    lines.push(`export const UNIFORMS_SIZE_BYTES = ${totalBytes}`, '')

    // Per-view offset maps. Each uniform field appears only under the map
    // whose typed-array view matches its Slang scalar type
    // (`UNIFORM_OFFSET_F32` for float, `_I32` for int, `_U32` for uint), so
    // writing a field through the wrong view (`f32[U.someIntField]`) is a
    // compile error instead of silent value corruption. The word offset is
    // identical across views — the split only constrains which fields each
    // view may address. Empty maps aren't emitted (a float-only shader has no
    // `_I32` / `_U32`).
    // Array fields are deliberately absent from these maps and appear only in
    // UNIFORM_SLOT_ARRAYS below: a single word offset for an array reads like
    // the whole field, and `u32[U.palette] = x` would write element 0 and
    // silently leave the rest.
    const uniformOffsets = u.fields.flatMap(f =>
      f.binding?.kind === 'uniform' && f.type.kind !== 'array'
        ? [{ name: f.name, word: f.binding.offset / 4, view: viewOf(f.type) }]
        : [],
    )
    for (const view of VIEWS) {
      const fields = uniformOffsets.filter(o => o.view === view)
      if (fields.length > 0) {
        lines.push(
          `// Word indices into a ${VIEW_ARRAY[view]} view over the uniform buffer.`,
          // #shaderExport UNIFORM_OFFSET_F32 / _U32 / _I32 | per-field indices into the uniform scratch buffer, one map per view
          `export const UNIFORM_OFFSET_${view.toUpperCase()} = {`,
        )
        for (const o of fields) {
          lines.push(`  ${o.name}: ${o.word},`)
        }
        lines.push('} as const', '')
      }
    }

    // Word offset of every element of every array field, so a TS caller can
    // fill a palette by index without knowing std140's element stride.
    //
    // These come from the reflected ARRAY type. They used to be inferred from
    // field NAMES — any two fields sharing a prefix with consecutive integer
    // suffixes from 0 were assumed to be a palette — which both invented arrays
    // that weren't (synteny's `panPx0`/`panPx1` are a per-side pan pair, and got
    // a slot array nothing could sensibly index) and forced the shader to keep
    // the fiction up: `arcColorByIndex` copied nine separately-named uniforms
    // into a local array on every vertex in order to subscript them.
    const arrayFields = u.fields.flatMap(f => {
      if (f.type.kind !== 'array') {
        return []
      }
      assertNoScalarArray(baseName, f, f.type)
      return [
        {
          name: f.name,
          words: arrayElementWords(f, f.type),
          type: f.type,
          view: viewOf(f.type),
        },
      ]
    })
    if (arrayFields.length > 0) {
      lines.push(
        '',
        '// Word indices of each array field’s elements, into a 4-byte-word',
        '// view over the uniform buffer (Uint32Array or Float32Array — the',
        '// field’s scalar type picks, same as UNIFORM_OFFSET_*). NOT',
        '// consecutive: std140 pads every array element to 16 bytes.',
        // #shaderExport UNIFORM_SLOT_ARRAYS | element counts for array-valued uniform slots
        'export const UNIFORM_SLOT_ARRAYS = {',
      )
      for (const a of arrayFields) {
        lines.push(`  ${a.name}: [${a.words.join(', ')}] as const,`)
      }
      lines.push('} as const', '')
      lines.push(...uniformArraySetterLines(arrayFields))
    }

    // #shaderExport Uniforms | the uniform block as a TS interface, one field per shader uniform; `writeUniforms` takes it
    lines.push('', 'export interface Uniforms {')
    for (const f of u.fields) {
      lines.push(`  ${f.name}: ${tsFieldType(f.type)}`)
    }
    lines.push('}', '')

    const writtenFields = u.fields.filter(f => f.binding?.kind === 'uniform')
    lines.push(
      // #shaderExport writeUniforms | typed whole-block writer; the alternative to poking offsets
      'export function writeUniforms(buf: ArrayBuffer, uniforms: Uniforms) {',
      ...declareViews(new Set(writtenFields.map(f => viewOf(f.type)))),
    )
    for (const f of writtenFields) {
      // Narrowed by the filter above; re-tested so TS can see it.
      const off4 = f.binding?.kind === 'uniform' ? f.binding.offset / 4 : 0
      const view = viewOf(f.type)
      if (f.type.kind === 'scalar') {
        lines.push(`  ${view}[${off4}] = uniforms.${f.name}`)
      } else if (f.type.kind === 'array') {
        // Each element strides by std140's 16 bytes, and an element that is
        // itself a vector then packs tight within its slot.
        const strideWords = f.type.uniformStride / 4
        const comps =
          f.type.elementType.kind === 'scalar'
            ? 1
            : f.type.elementType.elementCount
        for (let i = 0; i < f.type.elementCount; i++) {
          const at = off4 + i * strideWords
          if (comps === 1) {
            lines.push(`  ${view}[${at}] = uniforms.${f.name}[${i}]`)
          } else {
            for (let c = 0; c < comps; c++) {
              lines.push(
                `  ${view}[${at + c}] = uniforms.${f.name}[${i}][${c}]`,
              )
            }
          }
        }
      } else {
        for (let i = 0; i < f.type.elementCount; i++) {
          lines.push(`  ${view}[${off4 + i}] = uniforms.${f.name}[${i}]`)
        }
      }
    }
    lines.push('}', '')
  }

  if (vs) {
    const attrs = instanceAttrs(vs.struct, vs.source)
    assertNoReservedInstanceNames(baseName, attrs)

    lines.push(
      ...instanceLayoutLines(attrs),
      // #shaderExport VERTEX_ATTRIBUTES | the vertex input layout, used by both HALs — WebGPU builds its GPUVertexBufferLayout from it, WebGL2 its VAO pointers
      `export const VERTEX_ATTRIBUTES: readonly VertexAttributeLayout[] = [`,
    )
    for (const a of attrs) {
      const view = viewOf(a.type)
      const comps = a.type.kind === 'scalar' ? 1 : a.type.elementCount
      lines.push(
        `  { name: 'a_${a.name}', components: ${comps}, type: '${VIEW_COMPONENT[view]}', offsetBytes: ${a.offsetBytes}, integer: ${view !== 'f32'} },`,
      )
    }
    lines.push(']', '')

    lines.push(...instancePackerLines(attrs), ...instanceAccessorLines(attrs))
    if (instanceWriter) {
      lines.push(...instanceWriterLines(attrs))
    }
  }

  if (textures && textures.length > 1) {
    // Both HALs bind `textures[0]` and ignore the rest (webgl2Hal.ts,
    // webgpuHal.ts), so emitting the full list would leave the second sampler
    // reading whatever was last bound to that unit — a wrong picture, on both
    // backends, with nothing to attribute it to. Refuse here, where the message
    // can name the samplers, rather than at whatever the shader renders.
    throw new Error(
      `${baseName}.slang declares ${textures.length} combined samplers ` +
        `(${textures.map(t => t.name).join(', ')}), but the HALs bind only the ` +
        `first — multi-texture passes are not implemented. Combine them into ` +
        `one texture, or teach both HALs (and PipelineDescriptor.textures) to bind ` +
        `the whole list.`,
    )
  }
  if (textures && textures.length > 0) {
    lines.push(
      '// Combined `Sampler2D` bindings. Texture unit indices start at 0.',
      // Emitted as a non-empty tuple type so it matches ShaderModule.TEXTURES
      // (which slangPass.ts requires to be `readonly [TextureBinding, ...TextureBinding[]]`).
      // Codegen only enters this branch when textures.length > 0.
      // #shaderExport TEXTURES | texture bindings the shader declares
      'export const TEXTURES: readonly [TextureBinding, ...TextureBinding[]] = [',
    )
    for (let i = 0; i < textures.length; i++) {
      const t = textures[i]!
      lines.push(
        `  { textureBinding: ${t.textureBinding}, samplerBinding: ${t.samplerBinding}, glTextureUnit: ${i}, glUniformName: 'u_${t.name}', filter: 'linear' },`,
      )
    }
    lines.push(']', '')
  }

  return lines.join('\n')
}

// Emits only the `//! export-consts` values, and nothing that would make the
// module cost more than the numbers in it — no imports, no types, no packers.
// That is the point: this is the module a Canvas2D twin, a hit test or a state
// model imports, and those are the eager consumers. Written for every shader
// that declares the directive (as `${base}.consts.generated.ts`), as a module
// file's whole output, and for the `//! consts-out` copy in a package that can't
// import the owning plugin.
export function emitConsts(baseName: string, consts: Record<string, number>) {
  return [
    ...header(baseName),
    ...Object.entries(consts).flatMap(([name, value]) => [
      // #shaderExport (your shader's consts) | every other `public static const` in the shader, lifted by name
      `export const ${name} = ${value}`,
      '',
    ]),
  ].join('\n')
}

/**
 * The instance buffer's whole TypeScript surface — stride, per-view offset
 * maps, the struct-of-arrays packer and the per-field typed accessors — with no
 * shader source strings, no GL attributes and no imports. Written into a
 * package that can't import the plugin owning the full generated file
 * (packages/alignments-core reading the coverage-band layouts without being
 * able to import from plugins/alignments).
 *
 * It emitted the offset maps ALONE until the coverage band's packed buffers
 * became the only shipped form of those segments. That made this module the
 * place a worker WRITES a buffer and a hit test READS one, and with offsets
 * alone both spell `f32[i * STRIDE + OFFSET.yOffset]` by hand — which is the
 * interleave `packInstances` exists to delete, written per access instead of
 * per buffer, in the package furthest from the `.slang` that defines it. The
 * accessors bind each field to its own view, so a field that changes type in
 * the shader fails to compile at the call site instead of reinterpreting bits.
 */
export function emitLayoutOnly(
  inputs: Pick<CodegenInputs, 'baseName' | 'reflection' | 'instanceWriter'>,
) {
  const { baseName, reflection, instanceWriter } = inputs
  const vs = findInstanceStruct(reflection)
  if (!vs) {
    return header(baseName).join('\n')
  }
  const attrs = instanceAttrs(vs.struct, vs.source)
  assertNoReservedInstanceNames(baseName, attrs)
  return [
    ...header(baseName),
    ...instanceLayoutLines(attrs),
    ...instancePackerLines(attrs),
    ...instanceAccessorLines(attrs),
    ...(instanceWriter ? instanceWriterLines(attrs) : []),
  ].join('\n')
}
