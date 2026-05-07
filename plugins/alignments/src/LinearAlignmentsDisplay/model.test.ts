import { computeInsertSizeTicks } from './insertSizeTicks.ts'

describe('computeInsertSizeTicks', () => {
  it('returns undefined when availableHeight is invalid', () => {
    expect(
      computeInsertSizeTicks({
        arcsYDomainBp: 100,
        arcsHeight: 0,
        pairedArcsDown: true,
        arcsTop: 0,
      }),
    ).toBeUndefined()

    expect(
      computeInsertSizeTicks({
        arcsYDomainBp: 100,
        arcsHeight: -10,
        pairedArcsDown: true,
        arcsTop: 0,
      }),
    ).toBeUndefined()
  })

  it('returns valid ticks when inputs are valid', () => {
    const result = computeInsertSizeTicks({
      arcsYDomainBp: 500,
      arcsHeight: 40,
      pairedArcsDown: true,
      arcsTop: 0,
    })

    expect(result).toBeDefined()
    expect(result?.ticks.length).toBeGreaterThan(0)
    expect(result?.yTop).toBeDefined()
    expect(result?.yBottom).toBeDefined()
    // All y values should be finite
    expect(result?.ticks.every(t => Number.isFinite(t.y))).toBe(true)
  })

  it('generates ticks with finite y coordinates', () => {
    const result = computeInsertSizeTicks({
      arcsYDomainBp: 1000,
      arcsHeight: 50,
      pairedArcsDown: false,
      arcsTop: 10,
    })

    expect(result).toBeDefined()
    expect(result?.ticks.every(t => Number.isFinite(t.y))).toBe(true)
    expect(Number.isFinite(result?.yTop)).toBe(true)
    expect(Number.isFinite(result?.yBottom)).toBe(true)
  })
})
