import { emitInterface, emitLayoutOnly, emitShaderStrings } from './codegen.ts'

import type { Reflection } from './reflection.ts'

// The fixtures below are cast to `Reflection` rather than annotated: they are
// slangc's JSON, which carries more than the model declares, and an annotation
// would object to the extra keys a real reflection has.

function scalar(scalarType: 'float32' | 'uint32' | 'int32') {
  return { kind: 'scalar' as const, scalarType }
}
function vector(elementCount: number, scalarType: 'float32' | 'uint32') {
  return {
    kind: 'vector' as const,
    elementCount,
    elementType: scalar(scalarType),
  }
}
function uniform(offset: number, size: number) {
  return { kind: 'uniform' as const, offset, size }
}

function array(
  elementCount: number,
  of: ReturnType<typeof scalar> | ReturnType<typeof vector>,
) {
  // std140 pads every array element to 16 bytes whatever the element is, which
  // is the whole reason the emitted offsets can't just be consecutive words.
  return {
    kind: 'array' as const,
    elementCount,
    elementType: of,
    uniformStride: 16,
  }
}

// Uniform block mixing every scalar view (uint/int/float), two vec4 fields
// whose names share a prefix (`arcColor0`/`arcColor1` — NOT an array, and the
// old name-prefix heuristic wrongly treated them as one), and a real `uint[3]`
// array field.
const uniformParam = {
  name: 'u',
  binding: { kind: 'descriptorTableSlot', index: 1 },
  type: {
    kind: 'constantBuffer',
    elementType: {
      kind: 'struct',
      name: 'Uniforms',
      fields: [
        { name: 'flag', type: scalar('uint32'), binding: uniform(0, 4) },
        { name: 'level', type: scalar('int32'), binding: uniform(4, 4) },
        { name: 'scale', type: scalar('float32'), binding: uniform(8, 4) },
        {
          name: 'arcColor0',
          type: vector(4, 'float32'),
          binding: uniform(16, 16),
        },
        {
          name: 'arcColor1',
          type: vector(4, 'float32'),
          binding: uniform(32, 16),
        },
        {
          name: 'palette',
          type: array(3, vector(4, 'float32')),
          binding: uniform(48, 48),
        },
      ],
    },
    elementVarLayout: { binding: uniform(0, 96) },
  },
}

// Instance struct exercising a float vec2 + a uint scalar + an int scalar so
// the packer must pick f32 / u32 / i32 views per field.
const instanceParam = {
  name: 'instances',
  binding: { kind: 'descriptorTableSlot', index: 0 },
  type: {
    kind: 'resource',
    baseShape: 'structuredBuffer',
    resultType: {
      kind: 'struct',
      name: 'Inst',
      fields: [
        { name: 'pos', type: vector(2, 'float32') },
        { name: 'id', type: scalar('uint32') },
        { name: 'kind', type: scalar('int32') },
      ],
    },
  },
}

const reflection = {
  parameters: [uniformParam, instanceParam],
  entryPoints: [],
} as Reflection

describe('emitInterface uniforms', () => {
  const out = emitInterface({ baseName: 'test', reflection })

  test('splits word offsets into per-view maps by scalar type', () => {
    expect(out).toContain('export const UNIFORMS_SIZE_BYTES = 96')
    // float fields (incl. the vec palette) address the buffer through a
    // Float32Array, so they land in the F32 map.
    expect(out).toContain('export const UNIFORM_OFFSET_F32 = {')
    expect(out).toContain('scale: 2,')
    expect(out).toContain('arcColor0: 4,')
    expect(out).toContain('arcColor1: 8,')
    // int / uint fields get their own maps so `f32[U.flag]` can't compile.
    expect(out).toContain('export const UNIFORM_OFFSET_U32 = {')
    expect(out).toContain('flag: 0,')
    expect(out).toContain('export const UNIFORM_OFFSET_I32 = {')
    expect(out).toContain('level: 1,')
  })

  test('emits an element word offset per array entry, strided by std140', () => {
    // 16 bytes per element, so words 12, 16, 20 — never 12, 13, 14. Getting
    // this wrong writes three colors into the first color's slot.
    expect(out).toContain('palette: [12, 16, 20] as const,')
  })

  // The slot arrays used to be inferred from field NAMES, which invented arrays
  // out of any two fields sharing a prefix — synteny's `panPx0`/`panPx1` (a
  // per-side pan pair) got a slot array nothing could sensibly index.
  test('does not invent an array out of two same-prefix fields', () => {
    expect(out).not.toContain('arcColor: [')
  })

  // A single word offset for an array reads like the whole field, so
  // `u32[U.palette] = x` would write element 0 and silently drop the rest.
  test('keeps array fields out of the scalar offset maps', () => {
    expect(out).not.toMatch(/^ {2}palette: \d+,$/m)
  })

  test('writeUniforms selects u32 / i32 / f32 views per field', () => {
    expect(out).toContain('const f32 = new Float32Array(buf)')
    expect(out).toContain('const u32 = new Uint32Array(buf)')
    expect(out).toContain('const i32 = new Int32Array(buf)')
    expect(out).toContain('u32[0] = uniforms.flag')
    expect(out).toContain('i32[1] = uniforms.level')
    expect(out).toContain('f32[2] = uniforms.scale')
    expect(out).toContain('f32[4] = uniforms.arcColor0[0]')
    expect(out).toContain('f32[7] = uniforms.arcColor0[3]')
    expect(out).toContain('f32[8] = uniforms.arcColor1[0]')
  })

  test('typed Uniforms interface uses tuples for vectors and arrays', () => {
    expect(out).toContain('flag: number')
    expect(out).toContain('arcColor0: [number, number, number, number]')
    // A tuple, not `number[]`: the length is the shader's, so a palette built
    // one entry short is a compile error rather than a zeroed tail slot.
    expect(out).toContain(
      'palette: [[number, number, number, number], [number, number, number, number], [number, number, number, number]]',
    )
  })

  test('writeUniforms strides array elements by the std140 element stride', () => {
    // Element 1 starts at word 16, not 12 + 4-components-of-element-0 — those
    // happen to coincide for a vec4 and would not for a vec2.
    expect(out).toContain('f32[12] = uniforms.palette[0][0]')
    expect(out).toContain('f32[15] = uniforms.palette[0][3]')
    expect(out).toContain('f32[16] = uniforms.palette[1][0]')
    expect(out).toContain('f32[20] = uniforms.palette[2][0]')
  })
})

describe('emitInterface instances', () => {
  const out = emitInterface({ baseName: 'test', reflection })

  test('computes stride and field word offsets', () => {
    expect(out).toContain('export const INSTANCE_STRIDE_BYTES = 16')
    expect(out).toContain('export const INSTANCE_STRIDE_WORDS = 4')
    expect(out).toContain('pos: 0,')
    expect(out).toContain('id: 2,')
    expect(out).toContain('kind: 3,')
  })

  test('emits VERTEX_ATTRIBUTES with component counts, types and integer flags', () => {
    expect(out).toContain(
      "{ name: 'a_pos', components: 2, type: 'float', offsetBytes: 0, integer: false },",
    )
    expect(out).toContain(
      "{ name: 'a_id', components: 1, type: 'uint', offsetBytes: 8, integer: true },",
    )
    expect(out).toContain(
      "{ name: 'a_kind', components: 1, type: 'int', offsetBytes: 12, integer: true },",
    )
  })

  test('packInstances writes each field through its shader-derived view', () => {
    expect(out).toContain('f32[o + 0] = pos[i * 2 + 0]!')
    expect(out).toContain('f32[o + 1] = pos[i * 2 + 1]!')
    expect(out).toContain('u32[o + 2] = id[i]!')
    expect(out).toContain('i32[o + 3] = kind[i]!')
  })

  // The uniform side has had per-view maps since the offsets were split; the
  // instance side kept one flat map, so a hand-written packer (the ~190 sites
  // that can't use packInstances — they index a second array, or scale on the
  // way in) chose the destination view itself and could drift from the shader.
  // Each map holds only its own fields, so naming a `uint` through the f32 map
  // doesn't compile.
  test('splits instance offsets into per-view maps', () => {
    expect(out).toContain(
      ['export const INSTANCE_OFFSET_F32 = {', '  pos: 0,', '} as const'].join(
        '\n',
      ),
    )
    expect(out).toContain(
      ['export const INSTANCE_OFFSET_U32 = {', '  id: 2,', '} as const'].join(
        '\n',
      ),
    )
    expect(out).toContain(
      ['export const INSTANCE_OFFSET_I32 = {', '  kind: 3,', '} as const'].join(
        '\n',
      ),
    )
  })

  // The flat map is still emitted: too many call sites read it, and a packer
  // interleaving several sources into one buffer legitimately wants it.
  // The flat map is gone rather than deprecated. Keeping it would have left
  // both an unchecked way to do this and `_F32` meaning two different things in
  // adjacent constants — words there, a typed-array view in UNIFORM_OFFSET_F32.
  test('emits no flat offset map', () => {
    expect(out).not.toContain('FIELD_OFFSET_F32')
    expect(out).not.toContain('INSTANCE_STRIDE_F32')
  })
})

// A compute kernel binds StructuredBuffer<uint>, whose resultType reflects as a
// bare scalar — no fields to pack, unlike a vertex shader's
// StructuredBuffer<Inst>. Mirrors the real ldCompute.slang reflection.
const computeReflection = {
  parameters: [
    {
      name: 'genotypes',
      binding: { kind: 'descriptorTableSlot', index: 0 },
      type: {
        kind: 'resource',
        baseShape: 'structuredBuffer',
        resultType: scalar('uint32'),
      },
    },
    uniformParam,
  ],
  entryPoints: [
    {
      name: 'computeLD',
      stage: 'compute',
      threadGroupSize: [64, 1, 1],
      parameters: [],
    },
  ],
} as Reflection

describe('emitInterface compute', () => {
  const out = emitInterface({ baseName: 'test', reflection: computeReflection })

  test('emits entry point + workgroup size so TS dispatch tracks [numthreads]', () => {
    expect(out).toContain('export const COMPUTE_ENTRY_POINT = "computeLD"')
    expect(out).toContain('export const WORKGROUP_SIZE_X = 64')
  })

  test('emits uniform layout but no instance layout', () => {
    expect(out).toContain('export const UNIFORMS_SIZE_BYTES = 96')
    expect(out).toContain('u32[0] = uniforms.flag')
    expect(out).not.toContain('INSTANCE_STRIDE_BYTES')
    expect(out).not.toContain('VERTEX_ATTRIBUTES')
  })

  // Only the types the emitted module actually references: a compute kernel has
  // no attributes and no textures, so it imports neither — but it does have a
  // binding table, and the compute driver builds its bind group layout from it.
  test('imports only the HAL types it references', () => {
    expect(out).toContain(
      "import type { ShaderBinding } from '@jbrowse/render-core/hal'",
    )
    expect(out).not.toContain('VertexAttributeLayout')
    expect(out).not.toContain('TextureBinding')
  })

  // The compute kernel's own bindings, which is what replaced the LD driver's
  // hand-transcribed `createBindGroupLayout` entries.
  test('emits the binding table', () => {
    expect(out).toContain(
      [
        'export const BINDINGS: readonly ShaderBinding[] = [',
        "  { index: 0, kind: 'read-only-storage', name: 'genotypes' },",
        "  { index: 1, kind: 'uniform', name: 'u' },",
        ']',
      ].join('\n'),
    )
  })

  // Neither describes anything a dispatch does. Emitting them for a kernel
  // would put a TOPOLOGY on a module no pass can draw with, which reads as
  // though one could.
  test('refuses pipeline state on a shader with no vertex stage', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: computeReflection,
        topology: 'triangle-strip',
      }),
    ).toThrow(/no vertex stage/)
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: computeReflection,
        blend: 'premultiplied',
      }),
    ).toThrow(/no vertex stage/)
  })
})

// The `reflection` fixture's instance struct is `pos: float2, id: uint32, kind:
// int32`, which exercises everything the writer has to generalize in one shape:
// a vector field expanded into per-component parameters, and all three
// typed-array views over one buffer.
describe('emitInterface InstanceWriter', () => {
  const out = emitInterface({
    baseName: 'test',
    reflection,
    instanceWriter: true,
  })

  // Opt-in: a generated module is namespace-imported, which defeats
  // tree-shaking, so a class nobody calls is paid for by every eager importer.
  test('emits nothing without the directive', () => {
    expect(emitInterface({ baseName: 'test', reflection })).not.toContain(
      'InstanceWriter',
    )
  })

  test('expands a vector field into one parameter per component', () => {
    expect(out).toContain(
      '  push(pos0: number, pos1: number, id: number, kind: number) {',
    )
  })

  // The view per field is the shader's answer, which is the half maf's
  // hand-written copy could not generalize: it assumed every field was u32,
  // true of maf's struct and of nothing else.
  test('routes each field through the view its Slang type takes', () => {
    expect(out).toContain('    this.f32[o] = pos0')
    expect(out).toContain('    this.f32[o + 1] = pos1')
    expect(out).toContain('    this.u32[o + 2] = id')
    expect(out).toContain('    this.i32[o + 3] = kind')
  })

  // Every view has to be rebuilt against the new buffer, not just the first.
  // A grow that reattached only one would leave the others writing into the
  // buffer that was just abandoned — silently, and only past the seed.
  test('rebuilds every view on growth', () => {
    for (const v of ['f32', 'u32', 'i32']) {
      expect(out).toContain(`      this.${v} = new`)
      expect(out).toContain(`    this.${v} = new`)
    }
  })

  // A view would pin the whole over-allocation, and these payloads are retained
  // per region for as long as the region is loaded.
  test('right-sizes with a copy, and skips it when the seed was exact', () => {
    expect(out).toContain(
      '    return used === this.buf.byteLength ? this.buf : this.buf.slice(0, used)',
    )
  })

  // `finish` returns the buffer alone; the count is `writer.count`, and
  // `uploadPass` takes it off byteLength/stride.
  test('finish returns the buffer, not a {buffer, count} pair', () => {
    expect(out).not.toContain('count: this.count')
  })

  test('refuses on a shader with no instance struct', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: computeReflection,
        instanceWriter: true,
      }),
    ).toThrow(/no instance struct/)
  })

  // A vecN field contributes `<name>0`…, so a scalar of that name would give two
  // parameters one name and the second would silently win for both lanes.
  test('refuses two push parameters that would share a name', () => {
    const collide = {
      parameters: [
        {
          name: 'instances',
          binding: { kind: 'descriptorTableSlot' as const, index: 0 },
          type: {
            kind: 'resource' as const,
            baseShape: 'structuredBuffer',
            resultType: {
              kind: 'struct' as const,
              name: 'Inst',
              fields: [
                { name: 'position', type: vector(2, 'float32') },
                { name: 'position0', type: scalar('float32') },
              ],
            },
          },
        },
      ],
      entryPoints: [],
    } as Reflection
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: collide,
        instanceWriter: true,
      }),
    ).toThrow(/would be named 'position0'/)
  })
})

describe('emitInterface pipeline state', () => {
  test('emits nothing when the shader declares neither', () => {
    const out = emitInterface({ baseName: 'test', reflection })
    expect(out).not.toContain('TOPOLOGY')
    expect(out).not.toContain('BLEND_STATE')
  })

  // `as const` so the literal type survives: `PipelineDescriptor['topology']`
  // is a union of string literals, and a widened `string` would not assign.
  test('emits the topology as a literal type', () => {
    const out = emitInterface({
      baseName: 'test',
      reflection,
      topology: 'triangle-strip',
    })
    expect(out).toContain(`export const TOPOLOGY = 'triangle-strip' as const`)
  })

  // The mode names what the fragment stage produces; the factor pair is the
  // consequence, and lives only here.
  test('expands a blend mode into the factor pair it means', () => {
    const premul = emitInterface({
      baseName: 'test',
      reflection,
      blend: 'premultiplied',
    })
    expect(premul).toContain(
      `export const BLEND_STATE: BlendState = { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }`,
    )
    expect(
      emitInterface({ baseName: 'test', reflection, blend: 'max' }),
    ).toContain(`export const BLEND_STATE: BlendState = { op: 'max' }`)
  })

  test('imports BlendState only when it emits one', () => {
    const withBlend = emitInterface({
      baseName: 'test',
      reflection,
      blend: 'max',
    })
    expect(withBlend).toMatch(
      /import type \{[^}]*BlendState[^}]*\} from '@jbrowse\/render-core\/hal'/,
    )
    expect(emitInterface({ baseName: 'test', reflection })).not.toContain(
      'BlendState',
    )
  })
})

// packInstances destructures every field name into its own scope, so a field
// sharing a name with one of the packer's own bindings is shadowed. `count` was
// noticed and routed around (hence `numInstances`); the rest were not, and `o`
// or `i` would pack NaN into every instance without a word of complaint —
// `o[i]` on a number is undefined, and the arrays are typed.
test('refuses an instance field that would shadow a packInstances binding', () => {
  const shadowing = {
    parameters: [
      {
        ...instanceParam,
        type: {
          ...instanceParam.type,
          resultType: {
            kind: 'struct',
            name: 'Inst',
            fields: [
              { name: 'pos', type: vector(2, 'float32') },
              { name: 'o', type: scalar('uint32') },
            ],
          },
        },
      },
    ],
    entryPoints: [],
  } as Reflection
  expect(() =>
    emitInterface({ baseName: 'test', reflection: shadowing }),
  ).toThrow(/instance field 'o' collides/)
})

describe('emitLayoutOnly', () => {
  const out = emitLayoutOnly({ baseName: 'test', reflection })

  test('emits only stride + offsets', () => {
    expect(out).toContain('export const INSTANCE_STRIDE_BYTES = 16')
    expect(out).toContain('pos: 0,')
  })

  // This artifact exists FOR the package that can't import the owning plugin,
  // so it is the one place a hand-written packer has nothing to check itself
  // against. It used to carry no type information at all and its consumers
  // restated the struct in prose.
  test('carries the per-view maps too', () => {
    expect(out).toContain('export const INSTANCE_OFFSET_U32 = {')
    expect(out).toContain('export const INSTANCE_OFFSET_I32 = {')
  })

  test('omits VERTEX_ATTRIBUTES and packers', () => {
    expect(out).not.toContain('VERTEX_ATTRIBUTES')
    expect(out).not.toContain('packInstances')
    expect(out).not.toContain('UNIFORMS_SIZE_BYTES')
  })
})

describe('emitShaderStrings', () => {
  test('emits shader source constants and re-exports the interface', () => {
    const out = emitShaderStrings({
      baseName: 'test',
      reflection,
      wgsl: 'WGSL',
      glslVertex: 'VERT',
      glslFragment: 'FRAG',
    })
    expect(out).toContain('export const WGSL_SOURCE = "WGSL"')
    expect(out).toContain('export const GLSL_VERTEX = "VERT"')
    expect(out).toContain('export const GLSL_FRAGMENT = "FRAG"')
    expect(out).toContain("export * from './test.iface.generated.ts'")
  })
})

describe('emitInterface textures', () => {
  test('emits the TEXTURES binding and imports the HAL type', () => {
    const out = emitInterface({
      // A shader sampling a texture also draws geometry, so this reflection
      // carries instance attributes too — the case that imports both HAL types.
      baseName: 'test',
      reflection,
      textures: [{ name: 'colorRamp', textureBinding: 0, samplerBinding: 1 }],
    })
    expect(out).toContain(
      "{ textureBinding: 0, samplerBinding: 1, glTextureUnit: 0, glUniformName: 'u_colorRamp', filter: 'linear' },",
    )
    expect(out).toContain(
      "import type { VertexAttributeLayout, ShaderBinding, TextureBinding } from '@jbrowse/render-core/hal'",
    )
  })

  // Both HALs bind `textures[0]` and ignore the rest, so a second sampler would
  // read whatever was last bound to that unit — a wrong picture on both
  // backends with nothing to attribute it to. The emitter used to number the
  // whole list `glTextureUnit: 0, 1, …` as though it were wired up.
  test('refuses a second combined sampler the HALs would not bind', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection,
        textures: [
          { name: 'colorRamp', textureBinding: 0, samplerBinding: 1 },
          { name: 'mask', textureBinding: 2, samplerBinding: 3 },
        ],
      }),
    ).toThrow(/bind only the first/)
  })
})

// slangc segfaults — no diagnostic at all — on a scalar array in a uniform
// block, and only for WGSL, so it compiles cleanly right up until WebGPU.
// Refusing it here is the difference between a message and a bisection session.
test('refuses a uniform array of scalars, naming the fix', () => {
  const scalarArray = {
    parameters: [
      {
        name: 'u',
        binding: { kind: 'descriptorTableSlot' as const, index: 0 },
        type: {
          kind: 'constantBuffer' as const,
          elementType: {
            kind: 'struct' as const,
            name: 'Uniforms',
            fields: [
              {
                name: 'palette',
                type: array(3, scalar('uint32')),
                binding: uniform(0, 48),
              },
            ],
          },
          elementVarLayout: { binding: uniform(0, 48) },
        },
      },
    ],
    entryPoints: [],
  } as Reflection
  expect(() =>
    emitInterface({ baseName: 'test', reflection: scalarArray }),
  ).toThrow(/'palette' is an array of uint32.*Declare it as float4\[3\]/s)
})

// Tight packing is the rule for a vertex attribute and not for a struct in a
// storage buffer, where std430 aligns a vec2 to 8 and a vec3/vec4 to 16. This
// is the one layout nothing else can check: `assertVertexInputsMatch` keeps the
// tight model honest by comparing it against the shader's declared vertex
// inputs, and a storage-buffer shader declares none.
describe('storage-buffer instancing', () => {
  const bufferOf = (fields: { name: string; type: unknown }[]) =>
    ({
      parameters: [
        {
          name: 'instances',
          binding: { kind: 'descriptorTableSlot' as const, index: 0 },
          type: {
            kind: 'resource' as const,
            baseShape: 'structuredBuffer',
            resultType: { kind: 'struct' as const, name: 'Inst', fields },
          },
        },
      ],
      entryPoints: [],
    }) as Reflection

  test('refuses a field the tight cursor lands on the wrong alignment for', () => {
    const reflection = bufferOf([
      { name: 'a', type: vector(2, 'float32') },
      { name: 'b', type: scalar('float32') },
      // Tight puts this at 12; std430 puts it at 16.
      { name: 'c', type: vector(2, 'float32') },
    ])
    expect(() => emitInterface({ baseName: 'test', reflection })).toThrow(
      /'c' to 8 bytes.*offset 12/s,
    )
    // The layout-only artifact writes the same offsets, so it must refuse too.
    expect(() => emitLayoutOnly({ baseName: 'test', reflection })).toThrow(
      /std430/,
    )
  })

  test('accepts a struct whose tight layout already satisfies std430', () => {
    const reflection = bufferOf([
      { name: 'pos', type: vector(4, 'float32') },
      { name: 'uv', type: vector(2, 'float32') },
      { name: 'flags', type: scalar('uint32') },
    ])
    expect(emitLayoutOnly({ baseName: 'test', reflection })).toContain('uv: 4,')
  })

  test('a vertex-attribute struct with the same fields is fine', () => {
    // 4-byte alignment is all either backend asks of an attribute, so the
    // refusal above must not reach the case every shader in the tree uses.
    const reflection = {
      parameters: [],
      entryPoints: [
        {
          name: 'vsMain',
          stage: 'vertex' as const,
          parameters: [
            {
              name: 'inst',
              type: {
                kind: 'struct' as const,
                name: 'Inst',
                fields: [
                  { name: 'a', type: vector(2, 'float32') },
                  { name: 'b', type: scalar('float32') },
                  { name: 'c', type: vector(2, 'float32') },
                ],
              },
            },
          ],
        },
      ],
    } as Reflection
    expect(emitLayoutOnly({ baseName: 'test', reflection })).toContain('c: 3,')
  })
})

// slangc's reflection JSON is an open world and the types in reflection.ts are a
// closed one — three scalar types, three field kinds. TS therefore believes
// every `switch` over `t.kind` downstream is exhaustive, so an unmodeled shape
// doesn't land on a `default:`; it falls through to whichever branch tested
// last, and each one goes wrong differently and quietly. One gate, one sentence.
describe('unmodeled reflection shapes', () => {
  const withUniformField = (name: string, type: unknown) =>
    ({
      parameters: [
        {
          name: 'u',
          binding: { kind: 'descriptorTableSlot', index: 0 },
          type: {
            kind: 'constantBuffer',
            elementType: {
              kind: 'struct',
              name: 'Uniforms',
              fields: [{ name, type, binding: uniform(0, 16) }],
            },
            elementVarLayout: { binding: uniform(0, 16) },
          },
        },
      ],
      entryPoints: [],
    }) as unknown as Reflection

  // The one that was silent. A matrix has no `elementCount`, so it reached the
  // vector branch and `Array.from({ length: undefined })` typed it as an EMPTY
  // tuple: `xform: []` type-checked at every call site, `writeUniforms` never
  // wrote it, and one `UNIFORM_OFFSET_F32` word stood for sixteen. naga had no
  // objection either, because the shader itself is perfectly valid.
  test('refuses a matrix uniform instead of emitting an empty tuple', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: withUniformField('xform', {
          kind: 'matrix',
          rowCount: 4,
          columnCount: 4,
          elementType: scalar('float32'),
        }),
      }),
    ).toThrow(
      /field 'xform' is 'matrix', which the shader codegen does not model/,
    )
  })

  // This one reached `viewOf`, which read `.elementType.scalarType` off it and
  // threw a bare TypeError naming neither the field nor the shader.
  test('refuses a nested struct uniform with a message, not a TypeError', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: withUniformField('sub', {
          kind: 'struct',
          name: 'Sub',
          fields: [
            { name: 'a', type: scalar('float32'), binding: uniform(0, 4) },
          ],
        }),
      }),
    ).toThrow(/field 'sub' is 'struct'/)
  })

  // slangc really does emit `scalarType: "bool"`. `viewOf`'s final `else`
  // absorbed it as f32, so an integer field got a float view and a float write.
  test('refuses a scalar type with no typed-array view', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: withUniformField('enabled', {
          kind: 'scalar',
          scalarType: 'bool',
        }),
      }),
    ).toThrow(/scalar 'bool'.*no typed-array view/s)
  })

  // Same gate on the other struct whose bytes TS has to lay out. `sizeOf`
  // hardcodes 4 bytes per scalar, so an f64 attribute silently halves the
  // stride and every field after it lands at the wrong offset.
  test('refuses an unmodeled instance field', () => {
    expect(() =>
      emitInterface({
        baseName: 'test',
        reflection: {
          parameters: [],
          entryPoints: [
            {
              name: 'vs_main',
              stage: 'vertex',
              parameters: [
                {
                  name: 'inst',
                  type: {
                    kind: 'struct',
                    name: 'Instance',
                    fields: [
                      {
                        name: 'wide',
                        type: { kind: 'scalar', scalarType: 'float64' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        } as unknown as Reflection,
      }),
    ).toThrow(/instance struct 'Instance': field 'wide' is scalar 'float64'/)
  })
})
