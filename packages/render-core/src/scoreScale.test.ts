import { denormalizeScore, makeUnclampedScoreNormalizer } from './scoreScale.ts'
import {
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from './shaders/scoreScale.generated.ts'
import {
  normalizeScore,
  normalizeScoreUnclamped,
} from './shaders/scoreScale.js.generated.ts'

import type { ScaleTypeCode } from './scoreScale.ts'

const CASES: {
  name: string
  scaleType: ScaleTypeCode
  domain: [number, number]
  c: number
}[] = [
  { name: 'linear', scaleType: 0, domain: [0, 10], c: 1 },
  { name: 'linear crossing zero', scaleType: 0, domain: [-40, 60], c: 1 },
  { name: 'log', scaleType: SCALE_TYPE_LOG, domain: [1, 1024], c: 1 },
  { name: 'log under 1', scaleType: SCALE_TYPE_LOG, domain: [0.01, 0.5], c: 1 },
  {
    name: 'log floored at 1',
    scaleType: SCALE_TYPE_LOG,
    domain: [0, 64],
    c: 1,
  },
  { name: 'symlog', scaleType: SCALE_TYPE_SYMLOG, domain: [0, 1000], c: 1 },
  {
    name: 'symlog crossing zero',
    scaleType: SCALE_TYPE_SYMLOG,
    domain: [-40, 60],
    c: 0.06,
  },
]

const FRACTIONS = [0, 0.001, 0.1, 0.25, 0.5, 0.75, 0.999, 1]

describe.each(CASES)('$name', ({ scaleType, domain, c }) => {
  const [min, max] = domain
  test('the generated forward twin reads each fraction back', () => {
    for (const t of FRACTIONS) {
      const score = denormalizeScore(t, min, max, scaleType, c)
      expect(normalizeScore(score, min, max, scaleType, c)).toBeCloseTo(t, 9)
    }
  })

  test('the ends of the domain are the ends of the fraction', () => {
    const floor = scaleType === SCALE_TYPE_LOG && min <= 0 ? 1 : min
    expect(denormalizeScore(0, min, max, scaleType, c)).toBeCloseTo(floor, 9)
    expect(denormalizeScore(1, min, max, scaleType, c)).toBeCloseTo(max, 9)
  })

  test('a fraction past either end extrapolates rather than clamping', () => {
    expect(denormalizeScore(-0.5, min, max, scaleType, c)).toBeLessThan(
      denormalizeScore(0, min, max, scaleType, c),
    )
    expect(denormalizeScore(1.5, min, max, scaleType, c)).toBeGreaterThan(max)
  })
})

// A threshold cut is placed through the unclamped twin, so a cut the domain
// excludes lands off the plot rather than on the edge the scores beyond it are
// clamped onto. The wiggle line renderings color by comparing those two
// placements, and that tie read as crossed.
describe.each(CASES)('$name, unclamped', ({ scaleType, domain, c }) => {
  const [min, max] = domain
  const norm = (score: number) =>
    normalizeScoreUnclamped(score, min, max, scaleType, c)

  test('a score above the domain sits above its top', () => {
    expect(norm(max)).toBeCloseTo(1, 9)
    expect(norm(denormalizeScore(1.5, min, max, scaleType, c))).toBeCloseTo(
      1.5,
      9,
    )
  })

  test('the hoisted twin agrees, dividing as the shader does', () => {
    const hoisted = makeUnclampedScoreNormalizer(min, max, scaleType, c)
    for (const t of [-0.5, ...FRACTIONS, 1.5]) {
      const score = denormalizeScore(t, min, max, scaleType, c)
      if (scaleType === SCALE_TYPE_SYMLOG) {
        expect(hoisted(score)).toBeCloseTo(norm(score), 12)
      } else {
        expect(hoisted(score)).toBe(norm(score))
      }
    }
    expect(makeUnclampedScoreNormalizer(min, min, scaleType, c)(max)).toBe(
      normalizeScoreUnclamped(max, min, min, scaleType, c),
    )
  })

  test('the clamped twin is this one, clipped', () => {
    for (const t of [-0.5, ...FRACTIONS, 1.5]) {
      const score = denormalizeScore(t, min, max, scaleType, c)
      expect(normalizeScore(score, min, max, scaleType, c)).toBeCloseTo(
        Math.max(0, Math.min(1, norm(score))),
        9,
      )
    }
  })
})

test('a linear or symlog score below the domain sits below its floor', () => {
  for (const { scaleType, domain, c } of CASES) {
    if (scaleType === SCALE_TYPE_LOG) {
      continue
    }
    const [min, max] = domain
    const below = denormalizeScore(-0.5, min, max, scaleType, c)
    expect(normalizeScoreUnclamped(below, min, max, scaleType, c)).toBeCloseTo(
      -0.5,
      9,
    )
  }
})

// A segment into a zero bin is colored along its unclamped y, so a zero placed
// far under the floor moved the line's color change off the cut it crosses.
test('a log score under the floor sits just under it, below a cut at the floor', () => {
  const hoisted = makeUnclampedScoreNormalizer(10, 1000, SCALE_TYPE_LOG, 1)
  for (const norm of [
    hoisted,
    (s: number) => normalizeScoreUnclamped(s, 10, 1000, SCALE_TYPE_LOG, 1),
  ]) {
    expect(norm(10)).toBe(0)
    for (const under of [5, 0, -3]) {
      expect(norm(under)).toBeLessThan(0)
      expect(norm(under)).toBeGreaterThan(-0.001)
    }
  }
})

test('a NaN log score sits under the floor in both twins, as the shader max puts it', () => {
  const hoisted = makeUnclampedScoreNormalizer(1, 1000, SCALE_TYPE_LOG, 1)
  expect(hoisted(Number.NaN)).toBe(
    normalizeScoreUnclamped(Number.NaN, 1, 1000, SCALE_TYPE_LOG, 1),
  )
  expect(hoisted(Number.NaN)).toBeLessThan(0)
})

test('an infinite symlog score normalizes to the top, not NaN', () => {
  expect(normalizeScore(Infinity, 0, 1000, SCALE_TYPE_SYMLOG, 1)).toBe(1)
  expect(normalizeScoreUnclamped(Infinity, 0, 1000, SCALE_TYPE_SYMLOG, 1)).toBe(
    Infinity,
  )
})

test('a domain with no range answers where the forward step sits', () => {
  for (const scaleType of [0, SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG] as const) {
    for (const t of FRACTIONS) {
      expect(denormalizeScore(t, 5, 5, scaleType, 1)).toBeCloseTo(5, 9)
    }
  }
  expect(denormalizeScore(0.5, 0, 0, SCALE_TYPE_LOG, 1)).toBe(1)
})
