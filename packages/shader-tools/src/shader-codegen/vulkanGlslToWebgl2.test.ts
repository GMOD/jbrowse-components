import { vulkanGlslToWebgl2 } from './vulkanGlslToWebgl2.ts'

describe('vulkanGlslToWebgl2', () => {
  test('rewrites the Vulkan #version to GLSL ES 3.00 with precision', () => {
    const out = vulkanGlslToWebgl2('#version 460\nvoid main() {}\n', 'vertex')
    expect(out.startsWith('#version 300 es\n')).toBe(true)
    expect(out).toContain('precision highp float;')
    expect(out).toContain('precision highp int;')
    expect(out).not.toContain('#version 460')
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
