import { getDensityColor, makeDensityColorFn } from './getDensityColor.ts'

describe('makeDensityColorFn', () => {
  it('returns the same color as getDensityColor for each score', () => {
    const scores = [-1, -0.5, 0, 0.25, 0.5, 0.75, 1, 2]
    const colorFn = makeDensityColorFn(-1, 2, 'linear', '#f00')
    for (const score of scores) {
      expect(colorFn(score)).toBe(
        getDensityColor(score, -1, 2, 'linear', '#f00'),
      )
    }
  })

  it('works with log scale', () => {
    const scores = [0.1, 1, 10, 100]
    const colorFn = makeDensityColorFn(0.1, 100, 'log', '#00f')
    for (const score of scores) {
      expect(colorFn(score)).toBe(
        getDensityColor(score, 0.1, 100, 'log', '#00f'),
      )
    }
  })

  it('interpolates toward white for scores near zero', () => {
    // #ff0000 = red; G channel goes from 255 (white) down to 0 (full red)
    const colorFn = makeDensityColorFn(0, 1, 'linear', '#ff0000')
    const nearZero = colorFn(0.01)
    const atMax = colorFn(1)
    // parse G from "rgb(R,G,B)"
    const parseG = (s: string) => parseInt(s.split(',')[1]!, 10)
    expect(parseG(nearZero)).toBeGreaterThan(parseG(atMax))
  })

  it('domain with zero pivot produces full-strength color at max', () => {
    const colorFn = makeDensityColorFn(0, 1, 'linear', '#ff0000')
    expect(colorFn(1)).toBe('rgb(255,0,0)')
  })
})
