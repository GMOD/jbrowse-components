import { featureSpanContainsBp, featureSpanEndBp } from './featureSpanBp.ts'

describe('featureSpanEndBp', () => {
  it('leaves a span with width alone', () => {
    expect(featureSpanEndBp(100, 200)).toBe(200)
    expect(featureSpanEndBp(0, 1)).toBe(1)
  })

  it('gives a zero-length feature the one base it is painted from', () => {
    expect(featureSpanEndBp(4000, 4000)).toBe(4001)
    expect(featureSpanEndBp(0, 0)).toBe(1)
  })
})

describe('featureSpanContainsBp', () => {
  it('covers the interbase half-open span', () => {
    expect(featureSpanContainsBp(100, 200, 100)).toBe(true)
    expect(featureSpanContainsBp(100, 200, 199)).toBe(true)
    expect(featureSpanContainsBp(100, 200, 200)).toBe(false)
    expect(featureSpanContainsBp(100, 200, 99)).toBe(false)
  })

  it('covers a zero-length feature at its own base and nowhere else', () => {
    expect(featureSpanContainsBp(4000, 4000, 4000)).toBe(true)
    expect(featureSpanContainsBp(4000, 4000, 3999)).toBe(false)
    expect(featureSpanContainsBp(4000, 4000, 4001)).toBe(false)
  })

  it('covers a zero-length feature at position 0', () => {
    expect(featureSpanContainsBp(0, 0, 0)).toBe(true)
  })
})
