// The chevron pass measures its line in bp, so it is the one caller of
// `hpViewportOffsetBp`. That helper subtracts the hi and lo halves of the split
// separately because recombining bpStartHi+bpStartLo first loses ~256bp near
// 3e9, and a compiler is free to recombine them unless something stands in the
// way: `hpToClipX` spends a `max` against a runtime floor on exactly that, and
// this helper carried nothing until it took the same floor.
//
// So this reads what slangc emitted and asserts the two differences reach the
// sum each behind its own clamp. render-core's `hpClampFloor.test.ts` makes the
// matching assertion for the shaders that convert to clip space.
import { GLSL_VERTEX as chevronGlsl } from './chevron.glsl.generated.ts'
import { WGSL_SOURCE as chevronWgsl } from './chevron.wgsl.generated.ts'

const SOURCES = { wgsl: chevronWgsl, glsl: chevronGlsl }

function bodyOf(source: string) {
  const open = source.indexOf('{', source.indexOf('hpViewportOffsetBp_0('))
  return source.slice(open + 1, source.indexOf('}', open))
}

test.each(Object.entries(SOURCES))(
  'the %s chevron clamps each half of the split before summing them',
  (_target, source) => {
    const body = bodyOf(source)
    const clamps = [
      ...body.matchAll(/max\((\w+)_0\.(\w) - (\w+)_0\.(\w), (\w+)\)/g),
    ]
    expect(clamps.map(m => `${m[1]}.${m[2]} - ${m[3]}.${m[4]}`)).toEqual([
      'bpRange.x - splitPos.x',
      'bpRange.y - splitPos.y',
    ])

    const floor = clamps[0]![5]!
    expect(clamps[1]![5]).toBe(floor)
    expect(body).toMatch(
      new RegExp(
        `${floor}[^=]*=\\s*-?\\d[\\d.]*e[+-]\\d+f?\\s*\\+\\s*hpZero_\\d`,
      ),
    )
  },
)
