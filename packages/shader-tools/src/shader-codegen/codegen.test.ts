import {
  emitInterface,
  emitLayoutOnly,
  emitShaderStrings,
} from './codegen.ts'

// Reflection mirrors slangc's external JSON, which the codegen itself reads
// through casts (its declared types are deliberately partial). Name the
// expected input type off the emit function so fixtures stay in sync without
// exporting the internal reflection interfaces.
type Reflection = Parameters<typeof emitInterface>[0]['reflection']

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

// Uniform block mixing every scalar view (uint/int/float) plus a two-entry
// vec4 palette group (arcColor0/arcColor1) that should auto-collapse into a
// UNIFORM_SLOT_ARRAYS entry.
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
      ],
    },
    elementVarLayout: { binding: uniform(0, 48) },
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

  test('emits total size and word offsets', () => {
    expect(out).toContain('export const UNIFORMS_SIZE_BYTES = 48')
    expect(out).toContain('flag: 0,')
    expect(out).toContain('level: 1,')
    expect(out).toContain('scale: 2,')
    expect(out).toContain('arcColor0: 4,')
    expect(out).toContain('arcColor1: 8,')
  })

  test('auto-detects the palette slot-array group', () => {
    expect(out).toContain('arcColor: [4, 8] as const,')
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

  test('typed Uniforms interface uses tuples for vectors', () => {
    expect(out).toContain('flag: number')
    expect(out).toContain('arcColor0: [number, number, number, number]')
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
      baseName: 'test',
      reflection: { parameters: [], entryPoints: [] },
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
