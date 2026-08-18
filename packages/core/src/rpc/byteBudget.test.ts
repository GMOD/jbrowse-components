import { largestRegionBytes, overByteBudget } from './byteBudget.ts'

describe('largestRegionBytes', () => {
  it('keeps the biggest region, not the total', () => {
    expect(largestRegionBytes([300, 900, 500])).toBe(900)
  })

  it('stays under a budget every region individually fits', () => {
    expect(overByteBudget(largestRegionBytes([900, 900, 900]), 1000)).toBe(
      false,
    )
  })

  it('skips an unmeasurable region rather than reading it as zero', () => {
    expect(largestRegionBytes([undefined, 900, undefined])).toBe(900)
  })

  // `0` would read as a region that comfortably fits: a gate off in silence
  it('is unmeasurable, not zero, when nothing could be measured', () => {
    expect(largestRegionBytes([undefined, undefined])).toBeUndefined()
    expect(largestRegionBytes([])).toBeUndefined()
  })

  it('keeps a genuine zero measurement', () => {
    expect(largestRegionBytes([0])).toBe(0)
    expect(largestRegionBytes([0, undefined])).toBe(0)
  })

  it('handles a region count that would overflow a spread', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => i)
    expect(largestRegionBytes(many)).toBe(199_999)
    expect(() => Math.max(...many)).toThrow()
  })
})

// Shared so the worker's short-circuit and the banner cannot drift apart.
describe('overByteBudget', () => {
  it('is over only when strictly above the budget', () => {
    expect(overByteBudget(1001, 1000)).toBe(true)
    expect(overByteBudget(1000, 1000)).toBe(false)
    expect(overByteBudget(999, 1000)).toBe(false)
  })

  it('never gates without both a measurement and a budget', () => {
    expect(overByteBudget(undefined, 1000)).toBe(false)
    expect(overByteBudget(5_000_000, undefined)).toBe(false)
    expect(overByteBudget(undefined, undefined)).toBe(false)
  })
})
