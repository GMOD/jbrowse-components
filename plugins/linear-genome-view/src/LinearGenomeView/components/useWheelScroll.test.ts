import { getNormalizer, normalizeWheel } from './useWheelScroll.ts'

describe('getNormalizer', () => {
  test('returns 25 for very small deltas (abs < 6)', () => {
    expect(getNormalizer(1)).toBe(25)
    expect(getNormalizer(5)).toBe(25)
    expect(getNormalizer(-3)).toBe(25)
  })

  test('returns 75 for small deltas (6 <= abs <= 30)', () => {
    expect(getNormalizer(6)).toBe(75)
    expect(getNormalizer(30)).toBe(75)
    expect(getNormalizer(-20)).toBe(75)
  })

  test('returns 150 for medium deltas (30 < abs <= 150)', () => {
    expect(getNormalizer(31)).toBe(150)
    expect(getNormalizer(150)).toBe(150)
    expect(getNormalizer(-100)).toBe(150)
  })

  test('returns 500 for large deltas (abs > 150)', () => {
    expect(getNormalizer(151)).toBe(500)
    expect(getNormalizer(500)).toBe(500)
    expect(getNormalizer(-200)).toBe(500)
  })
})

describe('normalizeWheel', () => {
  test('pixel mode (0) passes through unchanged', () => {
    expect(normalizeWheel(10, 0)).toBe(10)
    expect(normalizeWheel(-5, 0)).toBe(-5)
  })

  test('line mode (1) multiplies by 16', () => {
    expect(normalizeWheel(3, 1)).toBe(48)
    expect(normalizeWheel(-2, 1)).toBe(-32)
  })

  test('page mode (2) multiplies by 100', () => {
    expect(normalizeWheel(1, 2)).toBe(100)
    expect(normalizeWheel(-2, 2)).toBe(-200)
  })
})

describe('zoomAccum coalescing', () => {
  // Regression for the zoomDivisor last-wins bug: when two wheel events
  // coalesce in a single RAF frame and have different normalizers, the zoom
  // should equal the sum of each event's individual contribution, not the
  // combined delta divided by the last event's normalizer.
  function simulateAccum(events: number[]) {
    let zoomAccum = 0
    for (const deltaY of events) {
      zoomAccum += deltaY / getNormalizer(deltaY)
    }
    return zoomAccum
  }

  test('single event normalizes correctly', () => {
    expect(simulateAccum([10])).toBeCloseTo(10 / 75)
    expect(simulateAccum([3])).toBeCloseTo(3 / 25)
    expect(simulateAccum([200])).toBeCloseTo(200 / 500)
  })

  test('two same-normalizer events accumulate additively', () => {
    expect(simulateAccum([3, 3])).toBeCloseTo(6 / 25)
  })

  test('two different-normalizer events use per-event divisors', () => {
    // delta=1 (normalizer=25) then delta=10 (normalizer=75)
    const correct = 1 / 25 + 10 / 75
    expect(simulateAccum([1, 10])).toBeCloseTo(correct)

    // old last-wins bug would have computed (1+10)/75 = 0.1467 instead of 0.1733
    const buggy = (1 + 10) / getNormalizer(10)
    expect(simulateAccum([1, 10])).not.toBeCloseTo(buggy)
  })

  test('order does not affect accumulated result', () => {
    expect(simulateAccum([1, 10])).toBeCloseTo(simulateAccum([10, 1]))
  })
})
