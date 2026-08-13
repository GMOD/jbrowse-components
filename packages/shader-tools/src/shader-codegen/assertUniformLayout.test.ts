import { assertUniformLayoutMatches } from './assertUniformLayout.ts'

import type { ExpectedUniformField } from './assertUniformLayout.ts'

// A float, a float, and a `float4[2]` — the smallest block that exercises the
// rule the whole check exists for: std140 pads an array element to 16 bytes, so
// `pal` starts at 16 rather than at 8 and strides 16 rather than by its element
// size.
const EXPECTED: ExpectedUniformField[] = [
  { name: 'a', offsetBytes: 0 },
  { name: 'b', offsetBytes: 4 },
  { name: 'pal', offsetBytes: 16, strideBytes: 16, elementCount: 2 },
]
const TOTAL = 48

// slangc names the struct through the `var<uniform>` declaration and puts its
// own `@align(N)` on every member, which is what this side walks.
const wgsl = (members: string) => `
@group(0) @binding(1) var<uniform> u_0 : Uniforms_std140_0;

struct Uniforms_std140_0
{
${members}
}
`

const WGSL_MEMBERS = [
  '    @align(16) a_0 : f32,',
  '    @align(4) b_0 : f32,',
  '    @align(16) pal_0 : array<vec4<f32>, i32(2)>,',
].join('\n')

const glsl = (members: string) => `
#version 300 es
layout(std140) uniform Uniforms
{
${members}
}u_0;
`

const GLSL_MEMBERS = [
  '    float a_0;',
  '    float b_0;',
  '    vec4 pal_0[2];',
].join('\n')

const both = {
  wgsl: wgsl(WGSL_MEMBERS),
  glslVertex: glsl(GLSL_MEMBERS),
}

test('accepts a block both backends lay out the way reflection reports', () => {
  expect(assertUniformLayoutMatches('x.slang', EXPECTED, TOTAL, both)).toBe(2)
})

test('the array element stride is 16, not the element size', () => {
  // The claim reflection.ts's JSDoc used to make in prose. Asserted from the
  // failure direction as well: a stride of 8 is what a naive `sizeof(element)`
  // model would produce for a float2 palette, and it must not pass.
  expect(() => {
    assertUniformLayoutMatches(
      'x.slang',
      [{ name: 'pal', offsetBytes: 0, strideBytes: 8, elementCount: 2 }],
      32,
      {
        wgsl: wgsl('    @align(16) pal_0 : array<vec2<f32>, i32(2)>,'),
      },
    )
  }).toThrow(/strides by 16 bytes per element .* and by 8 in reflection/)
})

describe('a field the two disagree about', () => {
  test('catches a WGSL offset the reflected maps would address wrong', () => {
    expect(() => {
      assertUniformLayoutMatches(
        'x.slang',
        [
          { name: 'a', offsetBytes: 0 },
          { name: 'b', offsetBytes: 8 },
          { name: 'pal', offsetBytes: 16, strideBytes: 16, elementCount: 2 },
        ],
        TOTAL,
        { wgsl: both.wgsl },
      )
    }).toThrow(
      /'b' is at byte 4 in the emitted block but reflection puts it at 8/,
    )
  })

  test('catches it on the GLSL side too', () => {
    expect(() => {
      assertUniformLayoutMatches(
        'x.slang',
        [
          { name: 'a', offsetBytes: 0 },
          { name: 'b', offsetBytes: 4 },
          { name: 'pal', offsetBytes: 32, strideBytes: 16, elementCount: 2 },
        ],
        64,
        { glslVertex: both.glslVertex },
      )
    }).toThrow(/\(GLSL\).*'pal' is at byte 16 .* reflection puts it at 32/s)
  })

  test('catches an emitted field reflection has no entry for', () => {
    expect(() => {
      assertUniformLayoutMatches(
        'x.slang',
        [
          { name: 'a', offsetBytes: 0 },
          { name: 'pal', offsetBytes: 16, strideBytes: 16, elementCount: 2 },
        ],
        TOTAL,
        { wgsl: both.wgsl },
      )
    }).toThrow(/declares 'b', which is not a reflected field/)
  })

  test('catches a reflected field the emitted block does not declare', () => {
    expect(() => {
      assertUniformLayoutMatches(
        'x.slang',
        [...EXPECTED, { name: 'extra', offsetBytes: 48 }],
        64,
        { wgsl: both.wgsl },
      )
    }).toThrow(/reflection declares uniform field\(s\) extra/)
  })
})

test('catches a UNIFORMS_SIZE_BYTES that does not cover the last field', () => {
  expect(() => {
    assertUniformLayoutMatches('x.slang', EXPECTED, 32, both)
  }).toThrow(
    /UNIFORMS_SIZE_BYTES is 32 but the last reflected field 'pal' ends at 48/,
  )
})

describe('finding nothing', () => {
  test('a block Slang eliminated from every target is not an error', () => {
    // `flatQuad.slang` declares a ConstantBuffer it never reads, so neither
    // backend emits the block while reflection goes on reporting it.
    expect(
      assertUniformLayoutMatches('x.slang', EXPECTED, TOTAL, {
        wgsl: 'fn vs_main() {}',
        glslVertex: 'void main() {}',
      }),
    ).toBe(0)
  })

  test('a declared block whose members do not parse is', () => {
    expect(() => {
      assertUniformLayoutMatches('x.slang', EXPECTED, TOTAL, {
        wgsl: wgsl('    a_0 : f32,'),
      })
    }).toThrow(/none of its members parsed/)
  })

  test('one target declaring the block and the other not is a parser break', () => {
    // The case the tree-wide count cannot see: half the check silently stops
    // running and the build stays green.
    expect(() => {
      assertUniformLayoutMatches('x.slang', EXPECTED, TOTAL, {
        wgsl: 'fn vs_main() {}',
        glslVertex: both.glslVertex,
      })
    }).toThrow(/GLSL output declares a uniform block and the WGSL one does not/)
  })
})
