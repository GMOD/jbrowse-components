import { makeDensityRgbStringFn } from './getDensityColor.ts'

describe('makeDensityRgbStringFn', () => {
  it('interpolates toward white for scores near zero', () => {
    // red; G channel goes from 255 (white) down to 0 (full red)
    const colorFn = makeDensityRgbStringFn(0, 1, false, 255, 0, 0)
    const parseG = (s: string) => parseInt(s.split(',', 2)[1]!, 10)
    expect(parseG(colorFn(0.01))).toBeGreaterThan(parseG(colorFn(1)))
  })

  it('domain with zero pivot produces full-strength color at max', () => {
    const colorFn = makeDensityRgbStringFn(0, 1, false, 255, 0, 0)
    expect(colorFn(1)).toBe('rgb(255,0,0)')
  })

  it('returns consistent strings (LUT cache hit)', () => {
    const colorFn = makeDensityRgbStringFn(-1, 2, false, 255, 0, 0)
    expect(colorFn(0.5)).toBe(colorFn(0.5))
  })

  it('works with log scale', () => {
    const colorFn = makeDensityRgbStringFn(0.1, 100, true, 0, 0, 255)
    // domainMin/max coerced via Math.max(_, 1) → log domain becomes [1, 100];
    // score=100 should produce the bluest result
    expect(colorFn(100)).toBe('rgb(0,0,255)')
  })
})
