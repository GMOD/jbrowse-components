import * as arrowGlsl from './arrow.glsl.generated.ts'
import * as arrowShader from './arrow.iface.generated.ts'
import * as arrowWgsl from './arrow.wgsl.generated.ts'
import * as chevronShader from './chevron.iface.generated.ts'
import * as continuationShader from './continuation.iface.generated.ts'
import * as lineGlsl from './line.glsl.generated.ts'
import * as lineShader from './line.iface.generated.ts'
import * as lineWgsl from './line.wgsl.generated.ts'
import * as rectGlsl from './rect.glsl.generated.ts'
import * as rectShader from './rect.iface.generated.ts'
import * as rectWgsl from './rect.wgsl.generated.ts'

// A display allocates its MSAA target unless every pass it registers measures
// its own edges, so one pass dropping the directive puts every feature track
// back at four samples.
test('every feature glyph pass measures its own coverage', () => {
  expect(
    [
      rectShader,
      lineShader,
      arrowShader,
      chevronShader,
      continuationShader,
    ].map(s => s.COVERAGE),
  ).toEqual(Array.from({ length: 5 }, () => 'analytic'))
})

// The directive is a claim: these three ramp their edges through the shared
// coverage, and a fragment that stopped calling it would draw hard edges at
// one sample with every numeric test still green.
test.each([
  ['rect', rectWgsl.WGSL_SOURCE, rectGlsl.GLSL_FRAGMENT],
  ['line', lineWgsl.WGSL_SOURCE, lineGlsl.GLSL_FRAGMENT],
  ['arrow', arrowWgsl.WGSL_SOURCE, arrowGlsl.GLSL_FRAGMENT],
])('%s ramps its edges on every backend', (_name, wgsl, glsl) => {
  for (const src of [wgsl, glsl]) {
    expect(src).toContain('edgeCoverage_0(')
  }
})
