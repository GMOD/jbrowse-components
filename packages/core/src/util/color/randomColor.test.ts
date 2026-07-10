import { randomColor } from './index.ts'

function parseHsl(color: string) {
  const m = /^hsl\((\d+), (\d+)%, (\d+)%\)$/.exec(color)
  if (!m) {
    throw new Error(`not an hsl string: ${color}`)
  }
  return { h: +m[1]!, s: +m[2]!, l: +m[3]! }
}

describe('randomColor', () => {
  test('is deterministic and stateless (same string -> same color)', () => {
    expect(randomColor('flaA')).toBe(randomColor('flaA'))
    expect(randomColor('flaA')).not.toBe(randomColor('flaB'))
  })

  test('emits a valid hsl string with in-range channels', () => {
    for (const str of ['', 'a', 'prfB', 'C694_RS00885', 'a longer string!']) {
      const { h, s, l } = parseHsl(randomColor(str))
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(360)
      expect(s).toBeGreaterThanOrEqual(58)
      expect(s).toBeLessThanOrEqual(82)
      // lightness stays mid-range so a color never disappears against a
      // black-or-white label overlaid on it
      expect(l).toBeGreaterThanOrEqual(38)
      expect(l).toBeLessThanOrEqual(58)
    }
  })

  test('varies saturation/lightness across values, not just hue', () => {
    const samples = ['prfB', 'fliR', 'efp', 'psel', 'lysS', 'ompA', 'clpB']
    const sls = new Set(samples.map(str => {
      const { s, l } = parseHsl(randomColor(str))
      return `${s},${l}`
    }))
    // a fixed-S/L hash would collapse this to a single pair
    expect(sls.size).toBeGreaterThan(1)
  })
})
