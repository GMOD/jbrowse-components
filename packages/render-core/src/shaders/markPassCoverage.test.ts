import * as pointGlsl from './pointMark.glsl.generated.ts'
import * as pointShader from './pointMark.iface.generated.ts'
import * as pointWgsl from './pointMark.wgsl.generated.ts'

// A mark display samples at four while any mark it lists does, so a track
// listing only points or rules draws at one only while this holds.
test('the point and rule pass measures its own coverage', () => {
  expect(pointShader.COVERAGE).toBe('analytic')
})

// The directive is a claim: a box that stopped measuring its area would draw
// hard edges at one sample with every numeric test still green.
test.each([
  ['wgsl', pointWgsl.WGSL_SOURCE],
  ['glsl', pointGlsl.GLSL_FRAGMENT],
])('the point pass inks its boxes by area in %s', (_name, src) => {
  expect(src).toContain('slabCoverage_0(')
})
