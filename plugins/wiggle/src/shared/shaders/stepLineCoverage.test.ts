import * as glsl from './wiggleLine.glsl.generated.ts'
import * as iface from './wiggleLine.iface.generated.ts'
import * as wgsl from './wiggleLine.wgsl.generated.ts'

// The wiggle display samples at four while its bars and density do; the step
// line is ready for one.
test('the step line measures its own coverage', () => {
  expect(iface.COVERAGE).toBe('analytic')
})

// A joint is up to four overlapping quads; under src-over their edge pixels
// compound and a dense line beads (the `wiggle-step-dense-flat` pixel
// fixture). Max unions them.
test('the step line unions its overlapping quads', () => {
  expect(iface.BLEND_STATE).toEqual({ op: 'max' })
})

// The directive is a claim: a quad that stopped measuring its area would draw
// hard edges at one sample with every numeric test still green.
test.each([
  ['wgsl', wgsl.WGSL_SOURCE],
  ['glsl', glsl.GLSL_FRAGMENT],
])('the step line inks its boxes by area in %s', (_name, src) => {
  expect(src).toContain('slabCoverage_0(')
})
