import { denormalizeScore } from './scoreScale.ts'
import {
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
} from './shaders/scoreScale.generated.ts'
import { normalizeScore } from './shaders/scoreScale.js.generated.ts'

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

test('a domain with no range answers where the forward step sits', () => {
  for (const scaleType of [0, SCALE_TYPE_LOG, SCALE_TYPE_SYMLOG] as const) {
    for (const t of FRACTIONS) {
      expect(denormalizeScore(t, 5, 5, scaleType, 1)).toBeCloseTo(5, 9)
    }
  }
  expect(denormalizeScore(0.5, 0, 0, SCALE_TYPE_LOG, 1)).toBe(1)
})
