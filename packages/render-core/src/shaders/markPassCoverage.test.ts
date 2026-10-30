import * as lineStepGlsl from './lineStepMark.glsl.generated.ts'
import * as lineStepShader from './lineStepMark.iface.generated.ts'
import * as lineStepWgsl from './lineStepMark.wgsl.generated.ts'
import * as pointGlsl from './pointMark.glsl.generated.ts'
import * as pointShader from './pointMark.iface.generated.ts'
import * as pointWgsl from './pointMark.wgsl.generated.ts'

// A mark display samples at four while any mark it lists does, so a track
// listing only points, rules or step lines draws at one only while these hold.
test('the point, rule and step line passes measure their own coverage', () => {
  expect([pointShader.COVERAGE, lineStepShader.COVERAGE]).toEqual([
    'analytic',
    'analytic',
  ])
})

// The directive is a claim: a box that stopped measuring its area would draw
// hard edges at one sample with every numeric test still green.
test.each([
  ['point', pointWgsl.WGSL_SOURCE, pointGlsl.GLSL_FRAGMENT],
  ['lineStep', lineStepWgsl.WGSL_SOURCE, lineStepGlsl.GLSL_FRAGMENT],
])('%s inks its boxes by area on every backend', (_name, wgsl, glsl) => {
  for (const src of [wgsl, glsl]) {
    expect(src).toContain('slabCoverage_0(')
  }
})
