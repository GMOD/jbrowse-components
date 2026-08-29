import {
  assertDprDeclared,
  assertNoDeadDprUniform,
  dprConsumersCalled,
  readsDprUniform,
} from './assertDprDeclared.ts'

// slangc's own spelling: every symbol carries a `_0` suffix, and a module's
// function is inlined into the importer under that name.
const CONVERTS = `fn edgeCoverage_0(a : f32, b : f32) -> f32 { return aaRamp_0(a, aaPx_0(b)); }
fn fs_main() { var x = edgeCoverage_0(1.0f, u_0.devicePixelRatio_0); }`
const PLAIN = `fn fs_main() { return vec4<f32>(1.0f); }`

describe('dprConsumersCalled', () => {
  test('finds the converters that survived inlining, in either backend', () => {
    expect(dprConsumersCalled({ wgsl: CONVERTS })).toEqual([
      'aaPx',
      'edgeCoverage',
    ])
    expect(dprConsumersCalled({ wgsl: PLAIN, glslFragment: CONVERTS })).toEqual(
      ['aaPx', 'edgeCoverage'],
    )
  })

  test('a compute shader has no GLSL halves and that is not an error', () => {
    expect(dprConsumersCalled({ wgsl: PLAIN })).toEqual([])
  })

  // The name alone is not a call. A shader mentioning `edgeCoverage` in a
  // comment slangc stripped, or declaring an unrelated `edgeCoverageScale`,
  // must not be read as converting.
  test('matches a call, not a mention', () => {
    expect(
      dprConsumersCalled({ wgsl: 'var edgeCoverageScale_0 = 2.0f;' }),
    ).toEqual([])
  })
})

describe('assertDprDeclared', () => {
  test('a shader that converts must declare the ratio', () => {
    expect(() =>
      assertDprDeclared(
        'gwas/manhattan.slang',
        ['pointRadius'],
        ['discExpand'],
      ),
    ).toThrow(/declares no 'devicePixelRatio'/)
  })

  // The failure this exists for: manhattan shipped with no dpr uniform and a
  // pad sized in CSS px, which is right on a dpr-1 monitor and 4x too wide on
  // a retina one.
  test('and passes once it does', () => {
    expect(
      assertDprDeclared(
        'gwas/manhattan.slang',
        ['pointRadius', 'devicePixelRatio'],
        ['discExpand'],
      ),
    ).toBe(1)
  })

  test('a shader that converts nothing needs nothing', () => {
    expect(assertDprDeclared('x.slang', ['canvasHeight'], [])).toBe(0)
  })

  test('a near-miss spelling is named, since the check cannot follow it', () => {
    expect(() =>
      assertDprDeclared('x.slang', ['dpr'], ['edgeCoverage']),
    ).toThrow(/It declares dpr — rename/)
  })
})

describe('assertNoDeadDprUniform', () => {
  const use = (
    over: Partial<Parameters<typeof assertNoDeadDprUniform>[0][0]>,
  ) =>
    ({
      shader: 'a.slang',
      owner: 'block.slang',
      fieldNames: ['devicePixelRatio'],
      reads: false,
      ...over,
    }) as const

  test('a field no shader in the group reads is dead', () => {
    expect(() => {
      assertNoDeadDprUniform([use({})])
    }).toThrow(/dead/)
  })

  // The reason this groups by the declaring module: alignments' one block
  // serves nineteen passes and only four antialias, so a per-shader rule would
  // condemn the other fifteen.
  test('one reader in the group is enough', () => {
    expect(() => {
      assertNoDeadDprUniform([
        use({ shader: 'read.slang' }),
        use({ shader: 'arc.slang', reads: true }),
      ])
    }).not.toThrow()
  })

  test('a block that never declares it is not dead, just uninterested', () => {
    expect(() => {
      assertNoDeadDprUniform([use({ fieldNames: ['canvasHeight'] })])
    }).not.toThrow()
  })
})

describe('readsDprUniform', () => {
  test('is about the field, not the converters', () => {
    expect(readsDprUniform({ wgsl: CONVERTS })).toBe(true)
    expect(readsDprUniform({ wgsl: PLAIN })).toBe(false)
    // variants' matrix: reads the ratio to snap column edges to the device
    // grid, and calls no ramp. Live, not dead.
    expect(
      readsDprUniform({
        wgsl: 'var w = u_0.canvasWidth_0 * u_0.devicePixelRatio_0;',
      }),
    ).toBe(true)
  })
})
