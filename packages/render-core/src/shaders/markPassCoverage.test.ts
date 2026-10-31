import * as pointGlsl from './pointMark.glsl.generated.ts'
import * as pointShader from './pointMark.iface.generated.ts'
import * as pointWgsl from './pointMark.wgsl.generated.ts'
import * as spanGlsl from './spanMark.glsl.generated.ts'
import * as spanWgsl from './spanMark.wgsl.generated.ts'

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

// Rows snapped to the device grid give a pixel shared by sub-pixel rows (a MAF
// fitted to more species than pixels) to one row, a different one after every
// resize, so the rows blinked; the four samples blend them only at fractional y.
test.each([
  ['wgsl', spanWgsl.WGSL_SOURCE],
  ['glsl', spanGlsl.GLSL_VERTEX],
])('the span pass places its rows at fractional y in %s', (_name, src) => {
  expect(src).not.toContain('snappedRowTopPx')
})
