import * as cellGlsl from './components/shaders/variant.glsl.generated.ts'
import * as cellShader from './components/shaders/variant.iface.generated.ts'
import * as cellWgsl from './components/shaders/variant.wgsl.generated.ts'
import * as matrixGlsl from './matrix/shaders/variantMatrix.glsl.generated.ts'
import * as matrixShader from './matrix/shaders/variantMatrix.iface.generated.ts'
import * as matrixWgsl from './matrix/shaders/variantMatrix.wgsl.generated.ts'

// Each layout registers one pass, so either dropping the directive puts that
// layout back on the 4x MSAA target.
test('both variant display passes measure their own coverage', () => {
  expect([cellShader.COVERAGE, matrixShader.COVERAGE]).toEqual([
    'analytic',
    'analytic',
  ])
})

// The directive is a claim about the rows: their hard edges draw the same at
// one sample as at four only while they sit on the device grid. A vertex stage
// that went back to fractional y would draw a row boundary half a pixel off
// with every other test still green.
test.each([
  ['cell', cellWgsl.WGSL_SOURCE, cellGlsl.GLSL_VERTEX],
  ['matrixCell', matrixWgsl.WGSL_SOURCE, matrixGlsl.GLSL_VERTEX],
])(
  '%s places its rows on the device grid on every backend',
  (_, wgsl, glsl) => {
    for (const src of [wgsl, glsl]) {
      expect(src).toContain('snappedRowTopPx_0(')
      expect(src).toContain('snappedRowBottomPx_0(')
    }
  },
)
