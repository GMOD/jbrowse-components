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
    expect(out).toContain('export const INSTANCE_STRIDE_F32 = 4')
    expect(out).toContain('pos: 0,')
    expect(out).toContain('id: 2,')
    expect(out).toContain('kind: 3,')
  })

  test('emits GL_ATTRIBUTES with component counts, types and integer flags', () => {
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
    expect(out).not.toContain('GL_ATTRIBUTES')
  })

  // Would otherwise emit an unused import — nothing here references the type.
  test('omits the HAL type import when there are no attributes or textures', () => {
    expect(out).not.toContain('@jbrowse/render-core/hal')
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

  test('omits GL_ATTRIBUTES and packers', () => {
    expect(out).not.toContain('GL_ATTRIBUTES')
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
  test('emits TEXTURES bindings with sequential GL texture units', () => {
    const out = emitInterface({
      // A shader sampling a texture also draws geometry, so this reflection
      // carries instance attributes too — the case that imports both HAL types.
      baseName: 'test',
      reflection,
      textures: [
        { name: 'colorRamp', textureBinding: 0, samplerBinding: 1 },
        { name: 'mask', textureBinding: 2, samplerBinding: 3 },
      ],
    })
    expect(out).toContain(
      "{ textureBinding: 0, samplerBinding: 1, glTextureUnit: 0, glUniformName: 'u_colorRamp', filter: 'linear' },",
    )
    expect(out).toContain(
      "{ textureBinding: 2, samplerBinding: 3, glTextureUnit: 1, glUniformName: 'u_mask', filter: 'linear' },",
    )
    expect(out).toContain(
      "import type { GlAttributeLayout, TextureBinding } from '@jbrowse/render-core/hal'",
    )
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
