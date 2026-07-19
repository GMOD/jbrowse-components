import {
  getChiSquareCritical,
  normalInverseCDF,
  passesHweFilter,
} from './hweFilter.ts'

describe('normalInverseCDF', () => {
  it('inverts the standard normal at known quantiles', () => {
    expect(normalInverseCDF(0.5)).toBeCloseTo(0, 6)
    expect(normalInverseCDF(0.975)).toBeCloseTo(1.959964, 4)
    expect(normalInverseCDF(0.025)).toBeCloseTo(-1.959964, 4)
    expect(normalInverseCDF(0.995)).toBeCloseTo(2.575829, 4)
  })
})

describe('getChiSquareCritical', () => {
  // χ²(df=1) critical values from standard tables.
  it('matches the df=1 table to 3 sig figs', () => {
    expect(getChiSquareCritical(0.05)).toBeCloseTo(3.841, 2)
    expect(getChiSquareCritical(0.01)).toBeCloseTo(6.635, 2)
    expect(getChiSquareCritical(0.001)).toBeCloseTo(10.828, 2)
    expect(getChiSquareCritical(0.0001)).toBeCloseTo(15.137, 2)
  })
  it('handles degenerate p-values', () => {
    expect(getChiSquareCritical(0)).toBe(Number.POSITIVE_INFINITY)
    expect(getChiSquareCritical(1)).toBe(0)
  })
})

describe('passesHweFilter', () => {
  const crit = getChiSquareCritical(0.05)

  it('keeps a variant in equilibrium', () => {
    // p=0.5, expected 25/50/25 out of 100 — perfect HWE proportions.
    expect(passesHweFilter(25, 50, 25, 100, crit)).toBe(true)
  })

  it('rejects a heterozygote-deficient variant', () => {
    // p=0.5 expects 50 hets; 0 hets (all homozygotes) is a gross departure.
    expect(passesHweFilter(50, 0, 50, 100, crit)).toBe(false)
  })

  it('keeps a mild departure within the critical value', () => {
    // p=0.5 expects 25/50/25; 30/40/30 is a small deviation (χ²≈4 > 3.841?)
    // 30/40/30: χ² = 1 + 2 + 1 = 4 > 3.841, so it is rejected at α=0.05.
    expect(passesHweFilter(30, 40, 30, 100, crit)).toBe(false)
    // 28/44/28: χ² = 0.36 + 0.72 + 0.36 = 1.44 < 3.841, kept.
    expect(passesHweFilter(28, 44, 28, 100, crit)).toBe(true)
  })
})
