// `hpToClipX` and `hpScaleLinear` clamp each half of the hi/lo split to a floor
// nothing can reach, and the clamp is there so no backend folds the split into
// one large subtraction. The floor used to be `-1.0 / hpZero`, and `hpZero` is
// uploaded as exactly 0 — a division by zero in every emitted backend, which
// WGSL lets an implementation answer with an indeterminate value rather than an
// infinity. (`coverageBandMarks.test.ts`, `coverageBandUboParity.test.ts` and
// maf's `coverageBandDraw.test.ts` are what hold the uploaded value at 0.)
//
// So: the floor must be a finite literal, the two clamps must survive, and
// `hpZero` must reach neither as a divisor.
import { GLSL_VERTEX as barMarkGlsl } from './barMark.glsl.generated.ts'
import { WGSL_SOURCE as barMarkWgsl } from './barMark.wgsl.generated.ts'
import { GLSL_VERTEX as coverageBarGlsl } from './coverageBar.glsl.generated.ts'
import { WGSL_SOURCE as coverageBarWgsl } from './coverageBar.wgsl.generated.ts'
import { GLSL_VERTEX as coverageIndicatorGlsl } from './coverageIndicator.glsl.generated.ts'
import { WGSL_SOURCE as coverageIndicatorWgsl } from './coverageIndicator.wgsl.generated.ts'
import { GLSL_VERTEX as coverageInterbaseGlsl } from './coverageInterbase.glsl.generated.ts'
import { WGSL_SOURCE as coverageInterbaseWgsl } from './coverageInterbase.wgsl.generated.ts'
import { GLSL_VERTEX as coverageModGlsl } from './coverageMod.glsl.generated.ts'
import { WGSL_SOURCE as coverageModWgsl } from './coverageMod.wgsl.generated.ts'
import { GLSL_VERTEX as coverageSnpGlsl } from './coverageSnp.glsl.generated.ts'
import { WGSL_SOURCE as coverageSnpWgsl } from './coverageSnp.wgsl.generated.ts'
import { GLSL_VERTEX as pointMarkGlsl } from './pointMark.glsl.generated.ts'
import { WGSL_SOURCE as pointMarkWgsl } from './pointMark.wgsl.generated.ts'
import { GLSL_VERTEX as spanMarkGlsl } from './spanMark.glsl.generated.ts'
import { WGSL_SOURCE as spanMarkWgsl } from './spanMark.wgsl.generated.ts'

const SOURCES = {
  'barMark wgsl': barMarkWgsl,
  'barMark glsl': barMarkGlsl,
  'coverageBar wgsl': coverageBarWgsl,
  'coverageBar glsl': coverageBarGlsl,
  'coverageIndicator wgsl': coverageIndicatorWgsl,
  'coverageIndicator glsl': coverageIndicatorGlsl,
  'coverageInterbase wgsl': coverageInterbaseWgsl,
  'coverageInterbase glsl': coverageInterbaseGlsl,
  'coverageMod wgsl': coverageModWgsl,
  'coverageMod glsl': coverageModGlsl,
  'coverageSnp wgsl': coverageSnpWgsl,
  'coverageSnp glsl': coverageSnpGlsl,
  'pointMark wgsl': pointMarkWgsl,
  'pointMark glsl': pointMarkGlsl,
  'spanMark wgsl': spanMarkWgsl,
  'spanMark glsl': spanMarkGlsl,
}

function bodyOf(source: string, name: string) {
  const open = source.indexOf('{', source.indexOf(`${name}(`))
  const close = source.indexOf('}', open)
  return source.slice(open + 1, close)
}

// The bp coordinates the split carries are uint32, so no difference of two of
// them reaches -2^33.
const BP_REACH = -(2 ** 33)

const CASES = Object.entries(SOURCES).flatMap(([where, source]) =>
  ['hpToClipX_0', 'hpScaleLinear_0']
    .filter(name => source.includes(`${name}(`))
    .map(name => [`${where} ${name}`, bodyOf(source, name)] as const),
)

test('every hp conversion the emitted backends carry is covered', () => {
  expect(CASES.length).toBe(Object.keys(SOURCES).length)
})

describe.each(CASES)('%s', (_where, body) => {
  test('never divides by the hpZero uniform', () => {
    expect(body).toMatch(/hpZero_\d+/)
    expect(body).not.toMatch(/\/\s*(-\s*)?\(?\s*hpZero_\d+/)
  })

  test('clamps both halves against a finite floor below any bp difference', () => {
    const floors = [...body.matchAll(/max\([^,]+,\s*(\w+)\)/g)].map(m => m[1])
    expect(floors).toHaveLength(2)
    expect(new Set(floors).size).toBe(1)

    const assigned = new RegExp(`${floors[0]}[^=]*=\\s*([^;]+);`).exec(body)
    const literal = /-?\d[\d.]*e[+-]\d+/.exec(assigned?.[1] ?? '')?.[0]
    expect(literal).toBeDefined()

    const floor = Number(literal)
    expect(Number.isFinite(floor)).toBe(true)
    expect(floor).toBeLessThan(BP_REACH)
    expect(Math.fround(floor)).toBe(floor)
  })
})
