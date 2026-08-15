import { vulkanGlslToWebgl2 } from './vulkanGlslToWebgl2.ts'

describe('vulkanGlslToWebgl2', () => {
  test('rewrites the Vulkan #version to GLSL ES 3.00 with precision', () => {
    const out = vulkanGlslToWebgl2('#version 460\nvoid main() {}\n', 'vertex')
    expect(out.startsWith('#version 300 es\n')).toBe(true)
    expect(out).toContain('precision highp float;')
    expect(out).toContain('precision highp int;')
    expect(out).not.toContain('#version 460')
  })

  // GLSL ES 3.00 predeclares `precision lowp sampler2D` in both stages (§4.5.4)
  // — unlike float, whose fragment default is absent rather than low — so a
  // sampled color came back at the edge of the 8 bits it was sampling, on
  // WebGL2 only. WebGPU has no equivalent notion, so the two backends read the
  // same ramp at different precisions.
  test('raises sampler precision, but only for a shader that has one', () => {
    const src = '#version 460\nvoid main() {}\n'
    expect(
      vulkanGlslToWebgl2(src, 'fragment', { samplers: ['colorRamp'] }),
    ).toContain('precision highp sampler2D;')
    expect(vulkanGlslToWebgl2(src, 'fragment')).not.toContain('sampler2D')
  })

  test('strips the shader_draw_parameters extension line', () => {
    const src =
      '#version 460\n#extension GL_ARB_shader_draw_parameters : require\nvoid main() {}\n'
    expect(vulkanGlslToWebgl2(src, 'vertex')).not.toContain('GL_ARB')
  })

  test('maps Vulkan vertex/instance builtins to GL ES equivalents', () => {
    const src =
      '#version 460\nint a = gl_VertexIndex - gl_BaseVertex;\n' +
      'int b = gl_InstanceIndex - gl_BaseInstance;\nint c = gl_VertexIndex;\n'
    const out = vulkanGlslToWebgl2(src, 'vertex')
    expect(out).toContain('int a = gl_VertexID;')
    expect(out).toContain('int b = gl_InstanceID;')
    expect(out).toContain('int c = gl_VertexID;')
    expect(out).not.toContain('gl_VertexIndex')
    expect(out).not.toContain('gl_BaseInstance')
  })

  test('drops explicit varying locations per stage', () => {
    const vsrc = '#version 460\nlayout(location = 0)\nout vec4 v;\n'
    expect(vulkanGlslToWebgl2(vsrc, 'vertex')).toContain('out vec4 v;')
    expect(vulkanGlslToWebgl2(vsrc, 'vertex')).not.toContain('location')

    const fsrc = '#version 460\nlayout(location = 0)\nin vec4 v;\n'
    expect(vulkanGlslToWebgl2(fsrc, 'fragment')).toContain('in vec4 v;')
    expect(vulkanGlslToWebgl2(fsrc, 'fragment')).not.toContain('location')
  })

  test('rewrites brace initializers to constructor calls', () => {
    const src = '#version 460\nvoid main() { Foo_0 x = { 1.0, 2.0, 3.0 }; }\n'
    expect(vulkanGlslToWebgl2(src, 'vertex')).toContain(
      'Foo_0 x = Foo_0(1.0, 2.0, 3.0);',
    )
  })

  test('rewrites two initializers in one function', () => {
    const src =
      '#version 460\nvoid main() { Foo_0 x = { 1.0 }; Bar_0 y = { 2.0, 3.0 }; }\n'
    const out = vulkanGlslToWebgl2(src, 'vertex')
    expect(out).toContain('Foo_0 x = Foo_0(1.0);')
    expect(out).toContain('Bar_0 y = Bar_0(2.0, 3.0);')
  })

  // The old `[^}]*?` form stopped at the first `}`, silently emitting truncated
  // GLSL. Failing the build is the only safe answer — the inner struct's
  // constructor name isn't recoverable from the initializer.
  test('throws on a nested brace initializer rather than truncating', () => {
    const src =
      '#version 460\nvoid main() { Foo_0 x = { { 1.0, 2.0 }, 3.0 }; }\n'
    expect(() => vulkanGlslToWebgl2(src, 'vertex')).toThrow(/nested brace/)
  })

  // `{ … };` after a declarator is an initializer; after `struct X` it is the
  // definition, and the rewriter must tell them apart. Referenced on purpose, or
  // `dropUnreferencedStructs` removes it for its own reasons and this stops
  // testing the rewriter.
  test('leaves a struct definition alone', () => {
    const src =
      '#version 460\nstruct Foo_0 { float a; };\nvoid main() { Foo_0 f; }\n'
    expect(vulkanGlslToWebgl2(src, 'vertex')).toContain(
      'struct Foo_0 { float a; };',
    )
  })

  test('renames the mangled uniform block to Uniforms', () => {
    const src =
      '#version 460\nlayout(std140) uniform block_MyUniforms_0 { float a; } u;\n'
    const out = vulkanGlslToWebgl2(src, 'vertex', {
      uniformBlockName: 'block_MyUniforms_0',
    })
    expect(out).toContain('layout(std140) uniform Uniforms')
    expect(out).not.toContain('block_MyUniforms_0')
  })

  test('renames mangled attributes to a_<field>', () => {
    const src = '#version 460\nin vec2 P_pos_0;\nin uint P_id_0;\n'
    const out = vulkanGlslToWebgl2(src, 'vertex', {
      attributes: { prefix: 'P', fieldNames: ['pos', 'id'] },
    })
    expect(out).toContain('in vec2 a_pos;')
    expect(out).toContain('in uint a_id;')
  })

  test('renames varyings to a shared v_<field> so stages link by name', () => {
    const vs = '#version 460\nout vec4 entryPointParam_vsMain_color_0;\n'
    const vout = vulkanGlslToWebgl2(vs, 'vertex', {
      varyings: { prefix: 'entryPointParam_vsMain', fieldNames: ['color'] },
    })
    expect(vout).toContain('out vec4 v_color;')

    const fs = '#version 460\nin vec4 pIn_color_0;\n'
    const fout = vulkanGlslToWebgl2(fs, 'fragment', {
      varyings: { prefix: 'pIn', fieldNames: ['color'] },
    })
    expect(fout).toContain('in vec4 v_color;')
  })

  test('renames combined samplers to u_<name>', () => {
    const src = '#version 460\nuniform sampler2D tex_0;\n'
    const out = vulkanGlslToWebgl2(src, 'fragment', { samplers: ['tex'] })
    expect(out).toContain('uniform sampler2D u_tex;')
    expect(out).not.toContain('tex_0')
  })
})

// slangc's disambiguating suffix counts declarations it has seen, so it is only
// USUALLY `_0`. A rename keyed on `_0` that misses is silent twice over: the
// WebGL2 shader keeps the mangled name, so `getAttribLocation('a_color')`
// returns -1 and that attribute reads a constant; and `assertVertexInputs`
// searches for `a_(\w+)` and iterates over what it FOUND, so the declaration it
// should have flagged simply drops out of the comparison.
describe('mangled-name renames', () => {
  test('renames an attribute whose suffix is not _0', () => {
    const out = vulkanGlslToWebgl2(
      '#version 460\nin vec2 inst_position_0;\nin uint inst_color_3;\n',
      'vertex',
      { attributes: { prefix: 'inst', fieldNames: ['position', 'color'] } },
    )
    expect(out).toContain('in vec2 a_position;')
    expect(out).toContain('in uint a_color;')
    expect(out).not.toContain('inst_')
  })

  test('a field name that is a prefix of another is not aliased onto it', () => {
    const out = vulkanGlslToWebgl2(
      '#version 460\nin float inst_color_0;\nin float inst_color2_0;\n',
      'vertex',
      { attributes: { prefix: 'inst', fieldNames: ['color', 'color2'] } },
    )
    expect(out).toContain('in float a_color;')
    expect(out).toContain('in float a_color2;')
  })

  test('refuses a leftover mangled identifier under the prefix', () => {
    expect(() =>
      vulkanGlslToWebgl2(
        '#version 460\nin vec2 inst_position_0;\nin uint inst_unknown_0;\n',
        'vertex',
        { attributes: { prefix: 'inst', fieldNames: ['position'] } },
      ),
    ).toThrow(/inst_unknown_0.*not any of the reflected names/s)
  })

  test('renames varyings and samplers past _0 too', () => {
    const out = vulkanGlslToWebgl2(
      '#version 460\nuniform sampler2D ramp_2;\nout vec4 entryPointParam_vsMain_color_1;\n',
      'vertex',
      {
        varyings: { prefix: 'entryPointParam_vsMain', fieldNames: ['color'] },
        samplers: ['ramp'],
      },
    )
    expect(out).toContain('out vec4 v_color;')
    expect(out).toContain('uniform sampler2D u_ramp;')
  })
})

// slangc emits the struct behind a `ConstantBuffer<T>` twice — a plain
// declaration nothing can reach, then the `layout(std140) uniform` block that is
// the real binding — and the plain one is shipped, member by member, in every
// generated module. Dropping it is stated as "unreferenced" rather than as a
// pattern match on slangc's shape, so these cases are about what may and may not
// be reached rather than about how the duplicate happens to be named.
describe('unreferenced struct declarations', () => {
  const UNIFORM_BLOCK =
    'struct Uniforms_0\n{\n    float a_0;\n    vec4 pal_0[9];\n};\n\n' +
    'layout(std140) uniform block_Uniforms_0\n{\n    float a_0;\n' +
    '    vec4 pal_0[9];\n}u_0;\n'

  test('drops the duplicate the uniform block leaves behind', () => {
    const out = vulkanGlslToWebgl2(`#version 460\n${UNIFORM_BLOCK}`, 'vertex', {
      uniformBlockName: 'block_Uniforms_0',
    })
    expect(out).not.toContain('struct Uniforms_0')
    // The binding itself survives, renamed — this is the half that matters.
    expect(out).toContain('layout(std140) uniform Uniforms')
    expect(out).toContain('}u_0;')
  })

  test.each([
    ['a local declaration', 'void main() { VsOut_0 o; }'],
    ['a return type', 'VsOut_0 make() { }'],
    ['a parameter', 'void take(VsOut_0 v) { }'],
    ['a constructor call', 'void main() { x = VsOut_0(1.0); }'],
  ])('keeps a struct reached by %s', (_what, use) => {
    const src = `#version 460\nstruct VsOut_0\n{\n    vec4 p_0;\n};\n${use}\n`
    expect(vulkanGlslToWebgl2(src, 'vertex')).toContain('struct VsOut_0')
  })

  // The rewrite above turns `X v = { … }` into `X( … )`, so a struct reached
  // only through a brace initializer is referenced by the time this runs. It
  // would not be if the two ever swapped order.
  test('keeps a struct reached only by a brace initializer', () => {
    const src =
      '#version 460\nstruct Pair_0\n{\n    float x_0;\n};\n' +
      'void main() { Pair_0 p = { 1.0 }; }\n'
    const out = vulkanGlslToWebgl2(src, 'vertex')
    expect(out).toContain('struct Pair_0')
    expect(out).toContain('Pair_0 p = Pair_0(1.0);')
  })

  // A prefix is not a reference. `Uniforms_0` and `Uniforms_01` are two structs.
  test('does not count a name that merely starts with the same text', () => {
    const src =
      '#version 460\nstruct Uniforms_0\n{\n    float a_0;\n};\n' +
      'void main() { Uniforms_01 v; }\n'
    expect(vulkanGlslToWebgl2(src, 'vertex')).not.toContain(
      'struct Uniforms_0\n',
    )
  })
})
