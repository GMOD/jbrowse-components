import { assertVertexInputsMatch } from './assertVertexInputs.ts'

import type { InstanceAttr } from './codegen.ts'

const attrs: InstanceAttr[] = [
  {
    name: 'startEnd',
    offsetBytes: 0,
    size: 8,
    type: {
      kind: 'vector',
      elementCount: 2,
      elementType: { kind: 'scalar', scalarType: 'uint32' },
    },
  },
  {
    name: 'y',
    offsetBytes: 8,
    size: 4,
    type: { kind: 'scalar', scalarType: 'float32' },
  },
  {
    name: 'color',
    offsetBytes: 12,
    size: 4,
    type: { kind: 'scalar', scalarType: 'uint32' },
  },
]

const wgsl = (body: string) => `struct vertexInput_0\n{\n${body}\n};\n`
const goodWgsl = wgsl(
  [
    '    @location(0) startEnd_0 : vec2<u32>,',
    '    @location(1) y_0 : f32,',
    '    @location(2) color_1 : u32,',
  ].join('\n'),
)
const goodGlsl = [
  'layout(location = 0)',
  'in uvec2 a_startEnd;',
  'layout(location = 1)',
  'in float a_y;',
  'layout(location = 2)',
  'in uint a_color;',
].join('\n')

test('accepts shaders whose inputs match the packed layout', () => {
  expect(() => {
    assertVertexInputsMatch(
      'x.slang',
      attrs,
      { wgsl: goodWgsl, glslVertex: goodGlsl },
      true,
    )
  }).not.toThrow()
})

// slangc drops an input the shader body never reads (GLSL) while keeping the
// surviving locations — the canvas line/chevron pair shares one buffer and each
// side reads only some fields, so this must stay legal.
test('tolerates a dead-code-eliminated input that keeps its location', () => {
  const withoutY = [
    'layout(location = 0)',
    'in uvec2 a_startEnd;',
    'layout(location = 2)',
    'in uint a_color;',
  ].join('\n')
  expect(() => {
    assertVertexInputsMatch('x.slang', attrs, { glslVertex: withoutY }, true)
  }).not.toThrow()
})

test('catches a location that no longer matches declaration order', () => {
  const reordered = wgsl(
    [
      '    @location(0) startEnd_0 : vec2<u32>,',
      '    @location(2) y_0 : f32,',
      '    @location(1) color_1 : u32,',
    ].join('\n'),
  )
  expect(() => {
    assertVertexInputsMatch('x.slang', attrs, { wgsl: reordered }, true)
  }).toThrow(/'y' is index 1 .* @location\(2\)/)
})

test('catches a type the packers would write wrong', () => {
  const retyped = goodGlsl.replace('in uint a_color;', 'in vec4 a_color;')
  expect(() => {
    assertVertexInputsMatch('x.slang', attrs, { glslVertex: retyped }, true)
  }).toThrow(/'color' at location 2 is 'vec4' .* packs it as 'uint'/)
})

test('catches an input with no matching struct field', () => {
  const extra = `${goodGlsl}\nlayout(location = 3)\nin float a_ghost;`
  expect(() => {
    assertVertexInputsMatch('x.slang', attrs, { glslVertex: extra }, true)
  }).toThrow(/declares vertex input 'ghost'/)
})

// Storage-buffer instancing: the struct is real and packed, but the shader
// indexes it in the body rather than declaring vertex inputs for it.
test('skips a shader with no vertex input struct', () => {
  expect(() => {
    assertVertexInputsMatch(
      'compute.slang',
      attrs,
      { wgsl: 'fn computeLD() {}' },
      false,
    )
  }).not.toThrow()
})

// The regexes here read slangc's emitted source, which slangc is free to
// reformat. Every assertion above is over what the parse found, so a parse that
// finds nothing passes them all — the guard has to notice that itself.
test('refuses to pass vacuously when it parses no inputs at all', () => {
  expect(() => {
    assertVertexInputsMatch(
      'x.slang',
      attrs,
      {
        wgsl: 'struct someOtherName_0 {\n  @location(0) startEnd_0 : vec2<u32>,\n};',
      },
      true,
    )
  }).toThrow(/no vertex input declarations were found/)

  expect(() => {
    assertVertexInputsMatch(
      'x.slang',
      attrs,
      { glslVertex: 'void main() {}' },
      true,
    )
  }).toThrow(/no vertex input declarations were found/)
})

// slangc emits the layout qualifier on its own line today; that is formatting,
// not contract, and pinning it was what made the check one reformat away from
// silently passing.
test('reads a vertex input whose layout qualifier shares its line', () => {
  const oneLine = [
    'layout(location = 0) in uvec2 a_startEnd;',
    'layout(location = 1) in float a_y;',
    'layout(location = 2) in vec4 a_color;',
  ].join('\n')
  expect(() => {
    assertVertexInputsMatch('x.slang', attrs, { glslVertex: oneLine }, true)
  }).toThrow(/'color' at location 2 is 'vec4'/)
})
