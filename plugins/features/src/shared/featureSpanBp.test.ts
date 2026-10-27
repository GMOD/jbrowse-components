import { featureSpanEndBp } from './featureSpanBp.ts'

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
