import {
  assertBindingsMatchWgsl,
  assertRenderBindingShape,
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
      { index: 1, kind: 'uniform', name: 'u' },
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
      { index: 0, kind: 'read-only-storage', name: 'genotypes' },
      { index: 1, kind: 'storage', name: 'ldOut' },
      { index: 2, kind: 'uniform', name: 'u' },
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
      { index: 1, kind: 'uniform', name: 'u' },
      { index: 2, kind: 'texture', name: 'colorRamp' },
      { index: 3, kind: 'sampler', name: 'colorRamp' },
    ])
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
  const uniformOnly = [{ index: 1, kind: 'uniform' as const, name: 'u' }]

  test('accepts the two shapes the HALs implement', () => {
    expect(() => {
      assertRenderBindingShape('t', uniformOnly)
    }).not.toThrow()
    expect(() => {
      assertRenderBindingShape('t', [
        ...uniformOnly,
        { index: 2, kind: 'texture', name: 'r' },
        { index: 3, kind: 'sampler', name: 'r' },
      ])
    }).not.toThrow()
  })

  // The render HALs' uniform-only layout (render-core's hal/deviceGpuCache.ts)
  // hardcodes binding 1 with a comment promising it "matches what the codegen
  // emits". This is the check that promise never had.
  test('refuses a uniform at any index but 1', () => {
    expect(() => {
      assertRenderBindingShape('t', [{ index: 0, kind: 'uniform', name: 'u' }])
    }).toThrow(/not one the render HALs bind/)
  })

  test('refuses a storage buffer in a render pass', () => {
    expect(() => {
      assertRenderBindingShape('t', [
        ...uniformOnly,
        { index: 2, kind: 'storage', name: 'out' },
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
  const table = [
    { index: 1, kind: 'uniform' as const, name: 'u' },
    { index: 2, kind: 'texture' as const, name: 'colorRamp' },
    { index: 3, kind: 'sampler' as const, name: 'colorRamp' },
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
          { index: 0, kind: 'read-only-storage', name: 'in' },
          { index: 1, kind: 'storage', name: 'out' },
        ],
        '@binding(0) @group(0) var<storage, read> in_0 : array<u32>;\n' +
          '@binding(1) @group(0) var<storage, read_write> out_0 : array<f32>;',
      )
    }).not.toThrow()
  })

  // slangc drops a binding the shader body never reads — flatQuad.slang
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
        [{ index: 0, kind: 'storage', name: 'in' }],
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
        [{ index: 0, kind: 'uniform', name: 'u' }],
        '@binding(0) @group(1) var<uniform> u_0 : U;',
      )
    }).toThrow(/@group\(1\)/)
  })
})
