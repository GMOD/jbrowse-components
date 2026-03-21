import {
  cssColorToNormalizedRgb,
  cssColorToNormalizedRgba,
  cssColorToRgba,
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  parseCssColor,
} from './colorBits.ts'

describe('colorBits helpers', () => {
  describe('parseCssColor', () => {
    test('hex colors', () => {
      const c = parseCssColor('#ff0000')
      expect(getRed(c)).toBe(255)
      expect(getGreen(c)).toBe(0)
      expect(getBlue(c)).toBe(0)
      expect(getAlpha(c)).toBe(255)
    })

    test('named colors', () => {
      expect(getRed(parseCssColor('red'))).toBe(255)
      expect(getBlue(parseCssColor('blue'))).toBe(255)
      expect(getRed(parseCssColor('lightgrey'))).toBe(211)
      expect(getRed(parseCssColor('teal'))).toBe(0)
      expect(getGreen(parseCssColor('teal'))).toBe(128)
    })

    test('transparent', () => {
      const c = parseCssColor('transparent')
      expect(getRed(c)).toBe(0)
      expect(getGreen(c)).toBe(0)
      expect(getBlue(c)).toBe(0)
      expect(getAlpha(c)).toBe(0)
    })

    test('rgb() functional notation', () => {
      const c = parseCssColor('rgb(100, 200, 50)')
      expect(getRed(c)).toBe(100)
      expect(getGreen(c)).toBe(200)
      expect(getBlue(c)).toBe(50)
    })

    test('hsl() functional notation', () => {
      const c = parseCssColor('hsl(0, 100%, 50%)')
      expect(getRed(c)).toBe(255)
      expect(getGreen(c)).toBe(0)
      expect(getBlue(c)).toBe(0)
    })

    test('case insensitive named colors', () => {
      expect(getRed(parseCssColor('RED'))).toBe(255)
      expect(getRed(parseCssColor('Red'))).toBe(255)
    })
  })

  describe('cssColorToNormalizedRgb', () => {
    test('returns values in 0-1 range', () => {
      const [r, g, b] = cssColorToNormalizedRgb('#ff8040')
      expect(r).toBe(1)
      expect(g).toBeCloseTo(0.502, 2)
      expect(b).toBeCloseTo(0.251, 2)
    })

    test('works with named colors', () => {
      const [r, g, b] = cssColorToNormalizedRgb('white')
      expect(r).toBe(1)
      expect(g).toBe(1)
      expect(b).toBe(1)
    })

    test('black is all zeros', () => {
      const [r, g, b] = cssColorToNormalizedRgb('black')
      expect(r).toBe(0)
      expect(g).toBe(0)
      expect(b).toBe(0)
    })
  })

  describe('cssColorToRgba', () => {
    test('returns 0-255 values with alpha', () => {
      const [r, g, b, a] = cssColorToRgba('#ff0000')
      expect(r).toBe(255)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBe(255)
    })

    test('transparent has zero alpha', () => {
      const [r, , , a] = cssColorToRgba('transparent')
      expect(r).toBe(0)
      expect(a).toBe(0)
    })

    test('named colors', () => {
      const [r, g, b, a] = cssColorToRgba('purple')
      expect(r).toBe(128)
      expect(g).toBe(0)
      expect(b).toBe(128)
      expect(a).toBe(255)
    })
  })

  describe('cssColorToNormalizedRgba', () => {
    test('returns 0-1 range for all channels', () => {
      const [r, g, b, a] = cssColorToNormalizedRgba('#ff000080')
      expect(r).toBe(1)
      expect(g).toBe(0)
      expect(b).toBe(0)
      expect(a).toBeCloseTo(0.502, 2)
    })

    test('fully opaque colors have alpha 1', () => {
      const [, , , a] = cssColorToNormalizedRgba('red')
      expect(a).toBe(1)
    })
  })
})
