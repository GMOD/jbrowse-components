import { largestRegionBytes, overByteBudget } from './byteBudget.ts'

// The reduction a per-region budget is compared against. Testable without a
// model or a worker, which is the point: both callers of it live in one or the
// other, and the rule they share is what decides whether a gate fires.
describe('largestRegionBytes', () => {
  it('keeps the biggest region, not the total', () => {
    expect(largestRegionBytes([300, 900, 500])).toBe(900)
  })

  // The whole reason the gate reduces this way: a multi-region view where every
  // region individually fits must not be blanked by what they add up to.
  it('stays under a budget every region individually fits', () => {
    const budget = 1000
    expect(overByteBudget(largestRegionBytes([900, 900, 900]), budget)).toBe(
      false,
    )
  })

  it('skips an unmeasurable region rather than reading it as zero', () => {
    expect(largestRegionBytes([undefined, 900, undefined])).toBe(900)
  })

  // The decision that matters most, because getting it wrong disables the gate
  // in silence: nothing measurable is "unmeasurable", and `0` would read as a
  // region that comfortably fits.
  it('is unmeasurable, not zero, when nothing could be measured', () => {
    expect(largestRegionBytes([undefined, undefined])).toBeUndefined()
    expect(largestRegionBytes([])).toBeUndefined()
  })

  // Zero is a real measurement — an index quotes chunks and a region with none
  // sums to zero — so it survives the reduction as a value rather than being
  // confused with the absence above.
  it('keeps a genuine zero measurement', () => {
    expect(largestRegionBytes([0])).toBe(0)
    expect(largestRegionBytes([0, undefined])).toBe(0)
  })

  // Reduced rather than spread, so the region count is not a bound on the call
  // stack. `Math.max(...arr)` throws here on a whole-genome set from an assembly
  // with many scaffolds.
  it('handles a region count that would overflow a spread', () => {
    const many = Array.from({ length: 200_000 }, (_, i) => i)
    expect(largestRegionBytes(many)).toBe(199_999)
    expect(() => Math.max(...many)).toThrow()
  })
})

// The comparison the worker's short-circuit and the main thread's banner both
// make. They reached it separately before, and a drift between them is a worker
// that refuses a region the banner calls fine: a blank display with nothing to
// refetch on.
describe('overByteBudget', () => {
  it('is over only when strictly above the budget', () => {
    expect(overByteBudget(1001, 1000)).toBe(true)
    expect(overByteBudget(1000, 1000)).toBe(false)
    expect(overByteBudget(999, 1000)).toBe(false)
  })

  // Two different absences that want the same answer: no measurement is
  // "unmeasurable", no budget is "nothing may gate right now". Neither refuses.
  it('never gates without both a measurement and a budget', () => {
    expect(overByteBudget(undefined, 1000)).toBe(false)
    expect(overByteBudget(5_000_000, undefined)).toBe(false)
    expect(overByteBudget(undefined, undefined)).toBe(false)
  })
})
