// `hpToClipX` and `hpViewportOffsetBp` clamp each half of the hi/lo split to a
// floor nothing can reach, and the clamp is there so no backend folds the split
// into one large subtraction. The floor used to be `-1.0 / hpZero`, and `hpZero` is
// uploaded as exactly 0 — a division by zero in every emitted backend, which
// WGSL lets an implementation answer with an indeterminate value rather than an
// infinity. (`coverageBandMarks.test.ts`, `coverageBandUboParity.test.ts` and
// maf's `coverageBandDraw.test.ts` are what hold the uploaded value at 0.)
//
// So: the floor must be a finite literal, the two clamps must survive, and
// `hpZero` must reach neither as a divisor.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../../..')

const HP_FUNCTIONS = ['hpToClipX_0', 'hpViewportOffsetBp_0']

const SOURCES = execFileSync(
  'git',
  ['ls-files', '*.wgsl.generated.ts', '*.glsl.generated.ts'],
  { cwd: root, encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean)
  .map(rel => [rel, readFileSync(path.join(root, rel), 'utf8')] as const)

function bodyOf(source: string, name: string) {
  const open = source.indexOf('{', source.indexOf(`${name}(`))
  const close = source.indexOf('}', open)
  return source.slice(open + 1, close)
}

// The bp coordinates the split carries are uint32, so no difference of two of
// them reaches -2^33.
const BP_REACH = -(2 ** 33)

const CASES = SOURCES.flatMap(([where, source]) =>
  HP_FUNCTIONS.filter(name => source.includes(`${name}(`)).map(
    name => [`${where} ${name}`, bodyOf(source, name)] as const,
  ),
)

test('finds the hp conversions across the tree', () => {
  expect(SOURCES.length).toBeGreaterThan(60)
  for (const name of HP_FUNCTIONS) {
    expect(
      CASES.filter(([where]) => where.endsWith(name)).length,
    ).toBeGreaterThan(4)
  }
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
