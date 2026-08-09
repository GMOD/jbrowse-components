import {
  findCombinedSamplers,
  findConstantBuffer,
  findFragmentInputParamName,
  findInstanceStruct,
  findUniformBlockName,
  findVaryingFieldNames,
  findVertexAttributeStruct,
} from './reflection.ts'

import type { Reflection } from './reflection.ts'

const f32 = { kind: 'scalar' as const, scalarType: 'float32' as const }
const vec = (elementCount: number) => ({
  kind: 'vector' as const,
  elementCount,
  elementType: f32,
})

// Trimmed from the real `hic.slang` reflection: a combined Sampler2D, a
// constant buffer, an ATTR-semantic vertex struct and a varying struct result.
const hic = {
  parameters: [
    {
      name: 'u',
      binding: { kind: 'descriptorTableSlot', index: 1 },
      type: {
        kind: 'constantBuffer',
        elementType: {
          kind: 'struct',
          name: 'Uniforms',
          fields: [
            {
              name: 'binWidth',
              type: f32,
              binding: { kind: 'uniform', offset: 0, size: 4 },
            },
          ],
        },
        elementVarLayout: { binding: { kind: 'uniform', offset: 0, size: 4 } },
      },
    },
    {
      name: 'colorRamp',
      binding: { kind: 'descriptorTableSlot', index: 2, count: 2 },
      type: {
        kind: 'resource',
        baseShape: 'texture2D',
        combined: true,
        resultType: vec(4),
      },
    },
  ],
  entryPoints: [
    {
      name: 'vs_main',
      stage: 'vertex',
      parameters: [
        {
          name: 'inst',
          binding: { kind: 'varyingInput', index: 0 },
          type: {
            kind: 'struct',
            name: 'HicInstance',
            fields: [
              { name: 'position', type: vec(2), semanticName: 'ATTR' },
              { name: 'count', type: f32, semanticName: 'ATTR' },
            ],
          },
        },
        { name: 'vid', semanticName: 'SV_VERTEXID', type: f32 },
      ],
      result: {
        type: {
          kind: 'struct',
          name: 'VsOut',
          fields: [
            // Carries SV_POSITION, not a varying — the fragment stage doesn't
            // read it as one, so it must not be renamed alongside them.
            { name: 'position', type: vec(4), semanticName: 'SV_POSITION' },
            {
              name: 'count',
              type: f32,
              binding: { kind: 'varyingOutput', index: 0 },
              semanticName: 'COLOR',
            },
          ],
        },
      },
    },
    {
      name: 'fs_main',
      stage: 'fragment',
      parameters: [
        { name: 'i', type: { kind: 'struct', name: 'VsOut', fields: [] } },
      ],
      result: { type: vec(4), semanticName: 'SV_TARGET' },
    },
  ],
} as Reflection

test('reads the uniform block and its slangc-side GLSL name', () => {
  expect(findConstantBuffer(hic)?.elementType.name).toBe('Uniforms')
  expect(findUniformBlockName(hic)).toBe('block_Uniforms_0')
})

test('reads the vertex attribute struct with the prefix slangc mangles in', () => {
  const vs = findVertexAttributeStruct(hic)
  expect(vs?.paramName).toBe('inst')
  expect(vs?.struct.fields.map(f => f.name)).toEqual(['position', 'count'])
})

test('takes only true varyings from the vertex result', () => {
  expect(findVaryingFieldNames(hic)).toEqual(['count'])
})

test('reads the fragment stage’s own parameter name for those varyings', () => {
  // Not the vertex side's name: each stage carries its own prefix, and using
  // one for both renamed nothing on the side that didn't match.
  expect(findFragmentInputParamName(hic)).toBe('i')
})

test('pairs a combined sampler with the slot after its texture', () => {
  expect(findCombinedSamplers(hic)).toEqual([
    { name: 'colorRamp', textureBinding: 2, samplerBinding: 3 },
  ])
})

describe('findInstanceStruct', () => {
  test('tags a vertex-attribute struct as one the shader declares inputs for', () => {
    expect(findInstanceStruct(hic)).toEqual({
      source: 'attributes',
      struct: findVertexAttributeStruct(hic)?.struct,
    })
  })

  // The tag is what keeps `assertVertexInputsMatch` from demanding vertex
  // input declarations of a shader that has none by design.
  test('prefers a storage buffer, and tags it as declaring no inputs', () => {
    const buffered = {
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
              fields: [{ name: 'pos', type: vec(2) }],
            },
          },
        },
        ...hic.parameters,
      ],
      entryPoints: hic.entryPoints,
    }
    const found = findInstanceStruct(buffered)
    expect(found?.source).toBe('buffer')
    expect(found?.struct.name).toBe('Inst')
  })

  // A compute kernel's StructuredBuffer<uint> reflects a scalar resultType.
  // Treating that as the instance struct would emit a packer with no fields.
  test('ignores a storage buffer of scalars', () => {
    const compute = {
      parameters: [
        {
          name: 'genotypes',
          binding: { kind: 'descriptorTableSlot', index: 0 },
          type: {
            kind: 'resource',
            baseShape: 'structuredBuffer',
            resultType: f32,
          },
        },
      ],
      entryPoints: [{ name: 'computeLD', stage: 'compute', parameters: [] }],
    } as Reflection
    expect(findInstanceStruct(compute)).toBeUndefined()
  })
})
