import {
  assertBindingsMatchWgsl,
  assertRenderBindingShape,
  assertStageReadsMatchWgsl,
  classifyBindings,
} from './bindings.ts'

import type { Reflection } from './reflection.ts'

// Fixtures are slangc's JSON, which carries more than the model declares.
const slot = (index: number, count?: number) => ({
  kind: 'descriptorTableSlot',
  index,
  ...(count === undefined ? {} : { count }),
})
const uniformParam = (name: string, index: number) => ({
  name,
  binding: slot(index),
  type: {
    kind: 'constantBuffer',
    elementType: { kind: 'struct', name: 'Uniforms', fields: [] },
    elementVarLayout: { binding: { kind: 'uniform', offset: 0, size: 0 } },
  },
})
const buffer = (name: string, index: number, readWrite = false) => ({
  name,
  binding: slot(index),
  type: {
    kind: 'resource',
    baseShape: 'structuredBuffer',
    ...(readWrite ? { access: 'readWrite' } : {}),
    resultType: { kind: 'scalar', scalarType: 'float32' },
  },
})
const sampler2D = (name: string, index: number) => ({
  name,
  binding: slot(index, 2),
  type: { kind: 'resource', baseShape: 'texture2D', combined: true },
})
const reflect = (...parameters: unknown[]) =>
  ({ parameters, entryPoints: [] }) as unknown as Reflection

describe('classifyBindings', () => {
  test('classifies the shapes the tree actually uses', () => {
    expect(classifyBindings('t.slang', reflect(uniformParam('u', 1)))).toEqual([
      { index: 1, kind: 'uniform', name: 'u', stages: [] },
    ])

    // A compute kernel: read-only in, read_write out, uniform last.
    expect(
      classifyBindings(
        't.slang',
        reflect(
          buffer('genotypes', 0),
          buffer('ldOut', 1, true),
          uniformParam('u', 2),
        ),
      ),
    ).toEqual([
      { index: 0, kind: 'read-only-storage', name: 'genotypes', stages: [] },
      { index: 1, kind: 'storage', name: 'ldOut', stages: [] },
      { index: 2, kind: 'uniform', name: 'u', stages: [] },
    ])
  })

  // A combined Sampler2D is one Slang declaration and two WebGPU slots. The
  // sampler's index is the one binding the codegen invents rather than reads,
  // which is why the duplicate check below matters and why the WGSL
  // cross-check exists at all.
  test('expands a combined sampler into texture + sampler', () => {
    expect(
      classifyBindings(
        't.slang',
        reflect(uniformParam('u', 1), sampler2D('colorRamp', 2)),
      ),
    ).toEqual([
      { index: 1, kind: 'uniform', name: 'u', stages: [] },
      { index: 2, kind: 'texture', name: 'colorRamp', stages: [] },
      { index: 3, kind: 'sampler', name: 'colorRamp', stages: [] },
    ])
  })

  // The bar mark's shape: the vertex stage resolves the colour through the
  // ramp, the fragment stage only reads the uniform. Each entry point's own
  // `used` flags are what the layout's visibility is built from.
  test('names the stages that read each binding', () => {
    const reads = (name: string, used: Record<string, 0 | 1>) => ({
      name,
      bindings: Object.entries(used).map(([param, flag]) => ({
        name: param,
        binding: { ...slot(0), used: flag },
      })),
    })
    const bar = {
      parameters: [uniformParam('u', 1), sampler2D('colorRamp', 2)],
      entryPoints: [
        { ...reads('vs_main', { u: 1, colorRamp: 1 }), stage: 'vertex' },
        { ...reads('fs_main', { u: 1, colorRamp: 0 }), stage: 'fragment' },
      ],
    } as unknown as Reflection
    expect(classifyBindings('t.slang', bar)).toEqual([
      { index: 1, kind: 'uniform', name: 'u', stages: ['vertex', 'fragment'] },
      { index: 2, kind: 'texture', name: 'colorRamp', stages: ['vertex'] },
      { index: 3, kind: 'sampler', name: 'colorRamp', stages: ['vertex'] },
    ])
  })

  // The whole-module compile flags nothing, and reading its silence as "no
  // stage reads it" would hide every binding from every stage.
  test('refuses an entry point that does not say whether it reads a binding', () => {
    const unflagged = {
      parameters: [uniformParam('u', 1)],
      entryPoints: [
        {
          name: 'vs_main',
          stage: 'vertex',
          bindings: [{ name: 'u', binding: slot(1) }],
        },
      ],
    } as unknown as Reflection
    expect(() => classifyBindings('t.slang', unflagged)).toThrow(
      /did not say whether entry point 'vs_main' reads 'u'/,
    )
  })

  // The bug this file exists for. `findConstantBuffer` returned the first match
  // and the second block simply vanished: UNIFORMS_SIZE_BYTES covering one of
  // them, a Uniforms interface missing the other's fields, and a @binding in
  // the emitted WGSL that nothing would ever write.
  test('refuses a second uniform block instead of dropping it', () => {
    expect(() => {
      classifyBindings(
        't.slang',
        reflect(uniformParam('ua', 1), uniformParam('ub', 2)),
      )
    }).toThrow(/2 uniform blocks \(ua, ub\)/)
  })

  test('refuses two parameters claiming one binding index', () => {
    expect(() => {
      classifyBindings(
        't.slang',
        reflect(uniformParam('u', 1), buffer('buf', 1)),
      )
    }).toThrow(/binding 1 is claimed by both/)
  })

  // The invented sampler index colliding with a real binding is the specific
  // way the expansion above could corrupt the table.
  test('catches a sampler expansion colliding with the next binding', () => {
    expect(() => {
      classifyBindings(
        't.slang',
        reflect(sampler2D('ramp', 2), uniformParam('u', 3)),
      )
    }).toThrow(/binding 3 is claimed by both/)
  })

  test('refuses a resource shape with no binding form', () => {
    expect(() => {
      classifyBindings(
        't.slang',
        reflect({
          name: 'tex',
          binding: slot(2),
          type: { kind: 'resource', baseShape: 'texture2D' },
        }),
      )
    }).toThrow(/declare it as one Sampler2D/)
  })

  test('refuses a parameter nothing could bind', () => {
    expect(() => {
      classifyBindings(
        't.slang',
        reflect({
          name: 'stray',
          type: { kind: 'scalar', scalarType: 'float32' },
        }),
      )
    }).toThrow(/has no descriptor-table binding/)
  })
})

describe('assertRenderBindingShape', () => {
  const both = ['vertex', 'fragment'] as const
  const uniformOnly = [
    { index: 1, kind: 'uniform' as const, name: 'u', stages: both },
  ]

  test('accepts the two shapes the HALs implement', () => {
    expect(() => {
      assertRenderBindingShape('t', uniformOnly)
    }).not.toThrow()
    expect(() => {
      assertRenderBindingShape('t', [
        ...uniformOnly,
        { index: 2, kind: 'texture', name: 'r', stages: both },
        { index: 3, kind: 'sampler', name: 'r', stages: both },
      ])
    }).not.toThrow()
  })

  // Every draw binds the uniform ring at 1.
  test('refuses a uniform at any index but 1', () => {
    expect(() => {
      assertRenderBindingShape('t', [
        { index: 0, kind: 'uniform', name: 'u', stages: both },
      ])
    }).toThrow(/not one the render HALs bind/)
  })

  test('refuses an empty table', () => {
    expect(() => {
      assertRenderBindingShape('t', [])
    }).toThrow(/not one the render HALs bind/)
  })

  test('refuses a storage buffer in a render pass', () => {
    expect(() => {
      assertRenderBindingShape('t', [
        ...uniformOnly,
        { index: 2, kind: 'storage', name: 'out', stages: both },
      ])
    }).toThrow(/not one the render HALs bind/)
  })
})

describe('assertBindingsMatchWgsl', () => {
  const wgsl = [
    '@binding(1) @group(0) var<uniform> u_0 : Uniforms_std140_0;',
    '@binding(2) @group(0) var colorRamp_texture_0 : texture_2d<f32>;',
    '@binding(3) @group(0) var colorRamp_sampler_0 : sampler;',
  ].join('\n')
  const stages = ['fragment'] as const
  const table = [
    { index: 1, kind: 'uniform' as const, name: 'u', stages },
    { index: 2, kind: 'texture' as const, name: 'colorRamp', stages },
    { index: 3, kind: 'sampler' as const, name: 'colorRamp', stages },
  ]

  test('accepts a table matching the emitted WGSL', () => {
    expect(() => {
      assertBindingsMatchWgsl('t', table, wgsl)
    }).not.toThrow()
  })

  test('reads storage access off the address space', () => {
    expect(() => {
      assertBindingsMatchWgsl(
        't',
        [
          { index: 0, kind: 'read-only-storage', name: 'in', stages: [] },
          { index: 1, kind: 'storage', name: 'out', stages: [] },
        ],
        '@binding(0) @group(0) var<storage, read> in_0 : array<u32>;\n' +
          '@binding(1) @group(0) var<storage, read_write> out_0 : array<f32>;',
      )
    }).not.toThrow()
  })

  // slangc drops a binding the shader body never reads — a shader that
  // declares a uniform block and then takes every value from its instance
  // attributes. That is DCE, and a pipeline layout may declare bindings the
  // shader doesn't use, so the check runs WGSL -> table only.
  test('tolerates a reflected binding slangc dead-code-eliminated', () => {
    expect(() => {
      assertBindingsMatchWgsl('t', table, '')
    }).not.toThrow()
  })

  test('catches a WGSL binding the table does not mention', () => {
    expect(() => {
      assertBindingsMatchWgsl('t', table.slice(0, 2), wgsl)
    }).toThrow(/declares a sampler at binding 3/)
  })

  test('catches a kind the two outputs disagree about', () => {
    expect(() => {
      assertBindingsMatchWgsl(
        't',
        [{ index: 0, kind: 'storage', name: 'in', stages: [] }],
        '@binding(0) @group(0) var<storage, read> in_0 : array<u32>;',
      )
    }).toThrow(
      /storage by reflection and a read-only-storage in the emitted WGSL/,
    )
  })

  test('refuses a bind group nothing sets', () => {
    expect(() => {
      assertBindingsMatchWgsl(
        't',
        [{ index: 0, kind: 'uniform', name: 'u', stages: [] }],
        '@binding(0) @group(1) var<uniform> u_0 : U;',
      )
    }).toThrow(/@group\(1\)/)
  })
})

describe('assertStageReadsMatchWgsl', () => {
  // slangc's shape for the bar mark: the vertex stage reaches the ramp through
  // a helper, the fragment stage through the uniform alone, and a struct field
  // shares a binding's spelling after a '.'.
  const wgsl = [
    '@binding(1) @group(0) var<uniform> u_0 : Uniforms_std140_0;',
    '@binding(2) @group(0) var colorRamp_texture_0 : texture_2d<f32>;',
    '@binding(3) @group(0) var colorRamp_sampler_0 : sampler;',
    'fn rampColor_0( t_0 : f32) -> vec4<f32>',
    '{',
    '    return textureSampleLevel(colorRamp_texture_0, colorRamp_sampler_0, vec2<f32>(t_0, 0.5f), 0.0f);',
    '}',
    'fn aa_0() -> f32',
    '{',
    '    return u_0.dpr_0;',
    '}',
    '@vertex',
    'fn vs_main( @builtin(vertex_index) vid_0 : u32) -> VsOut_0',
    '{',
    '    var o_0 : VsOut_0;',
    '    if(vid_0 > 0u) { o_0.color_0 = rampColor_0(aa_0()); }',
    '    return o_0;',
    '}',
    '@fragment',
    'fn fs_main( v_0 : VsOut_0) -> @location(0) vec4<f32>',
    '{',
    '    return v_0.colorRamp_texture_0 * aa_0();',
    '}',
  ].join('\n')
  const entryPoints = [
    { name: 'vs_main', stage: 'vertex' as const },
    { name: 'fs_main', stage: 'fragment' as const },
  ]
  const table = (rampStages: readonly ('vertex' | 'fragment')[]) => [
    {
      index: 1,
      kind: 'uniform' as const,
      name: 'u',
      stages: ['vertex', 'fragment'] as const,
    },
    {
      index: 2,
      kind: 'texture' as const,
      name: 'colorRamp',
      stages: rampStages,
    },
    {
      index: 3,
      kind: 'sampler' as const,
      name: 'colorRamp',
      stages: rampStages,
    },
  ]

  test('accepts a table naming every stage the WGSL reads each binding in', () => {
    expect(() => {
      assertStageReadsMatchWgsl('t', table(['vertex']), entryPoints, wgsl)
    }).not.toThrow()
  })

  // The defect this exists for: the ramp shown to the fragment stage alone
  // while the vertex stage samples it.
  test('catches a stage that reads a binding the table hides from it', () => {
    expect(() => {
      assertStageReadsMatchWgsl('t', table(['fragment']), entryPoints, wgsl)
    }).toThrow(
      /vertex entry point 'vs_main' reads binding 2 \('colorRamp', a texture\)/,
    )
  })

  // Reflection naming a stage the WGSL never reads only widens a layout.
  test('tolerates a stage the WGSL does not read the binding in', () => {
    expect(() => {
      assertStageReadsMatchWgsl(
        't',
        table(['vertex', 'fragment']),
        entryPoints,
        wgsl,
      )
    }).not.toThrow()
  })

  test('refuses an entry point it cannot find, rather than checking nothing', () => {
    expect(() => {
      assertStageReadsMatchWgsl(
        't',
        table(['vertex']),
        [...entryPoints, { name: 'cs_main', stage: 'compute' as const }],
        wgsl,
      )
    }).toThrow(/no '@compute fn cs_main' was found/)
  })
})
