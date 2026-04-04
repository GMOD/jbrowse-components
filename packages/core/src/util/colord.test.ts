import { colord, hexToGLrgb } from './colord.ts'

describe('colord wrapper over color-bits', () => {
  describe('parsing', () => {
    test('hex colors', () => {
      expect(colord('#ff0000').toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 })
      expect(colord('#00ff00').toRgb()).toEqual({ r: 0, g: 255, b: 0, a: 1 })
      expect(colord('#0000ff').toRgb()).toEqual({ r: 0, g: 0, b: 255, a: 1 })
    })

    test('short hex', () => {
      expect(colord('#f00').toRgb()).toEqual({ r: 255, g: 0, b: 0, a: 1 })
    })

    test('hex with alpha', () => {
      const c = colord('#ff000080')
      expect(c.toRgb().r).toBe(255)
      expect(c.toRgb().a).toBeCloseTo(0.502, 2)
    })

    test('named CSS colors', () => {
      expect(colord('red').toHex()).toBe('#ff0000')
      expect(colord('blue').toHex()).toBe('#0000ff')
      expect(colord('lightgrey').toHex()).toBe('#d3d3d3')
      expect(colord('teal').toHex()).toBe('#008080')
      expect(colord('pink').toHex()).toBe('#ffc0cb')
      expect(colord('purple').toHex()).toBe('#800080')
      expect(colord('navy').toHex()).toBe('#000080')
      expect(colord('green').toHex()).toBe('#008000')
    })

    test('rgb() strings', () => {
      expect(colord('rgb(255, 0, 0)').toRgb()).toEqual({
        r: 255,
        g: 0,
        b: 0,
        a: 1,
      })
    })

    test('rgba() strings', () => {
      const c = colord('rgba(255, 128, 0, 0.5)')
      expect(c.toRgb().r).toBe(255)
      expect(c.toRgb().g).toBe(128)
      expect(c.toRgb().b).toBe(0)
      expect(c.toRgb().a).toBeCloseTo(0.5, 1)
    })

    test('hsl() strings', () => {
      const c = colord('hsl(0, 100%, 50%)')
      expect(c.toRgb().r).toBe(255)
      expect(c.toRgb().g).toBe(0)
      expect(c.toRgb().b).toBe(0)
    })

    test('transparent', () => {
      const c = colord('transparent')
      expect(c.toRgb()).toEqual({ r: 0, g: 0, b: 0, a: 0 })
      expect(c.alpha()).toBe(0)
    })

    test('HSL object input', () => {
      const c = colord({ h: 0, s: 100, l: 50 })
      expect(c.toRgb().r).toBe(255)
      expect(c.toRgb().g).toBe(0)
      expect(c.toRgb().b).toBe(0)
    })

    test('invalid color falls back to black', () => {
      expect(colord('notacolor').toHex()).toBe('#000000')
    })

    test('case insensitive', () => {
      expect(colord('RED').toHex()).toBe('#ff0000')
      expect(colord('LightGrey').toHex()).toBe('#d3d3d3')
    })
  })

  describe('formatting', () => {
    test('toHex without alpha', () => {
      expect(colord('#ec8b8b').toHex()).toBe('#ec8b8b')
    })

    test('toHex with alpha includes alpha channel', () => {
      expect(colord('#ff0000').alpha(0.5).toHex()).toMatch(/^#ff0000/)
      expect(colord('#ff0000').alpha(0.5).toHex().length).toBe(9)
    })

    test('toRgbString', () => {
      expect(colord('#ff0000').toRgbString()).toBe('rgb(255, 0, 0)')
    })

    test('toRgbString with alpha', () => {
      const s = colord('#ff0000').alpha(0.5).toRgbString()
      expect(s).toMatch(/^rgba\(255, 0, 0,/)
    })

    test('toHslString', () => {
      expect(colord('#ff0000').toHslString()).toBe('hsl(0, 100%, 50%)')
    })
  })

  describe('manipulation', () => {
    test('alpha getter', () => {
      expect(colord('#ff0000').alpha()).toBe(1)
      expect(colord('transparent').alpha()).toBe(0)
    })

    test('alpha setter returns new Colord', () => {
      const c = colord('#ff0000').alpha(0.5)
      expect(c.alpha()).toBeCloseTo(0.5, 1)
      expect(c.toRgb().r).toBe(255)
    })

    test('darken reduces lightness', () => {
      const original = colord('#ec8b8b')
      const darkened = original.darken(0.2)
      expect(darkened.toHsl().l).toBeLessThan(original.toHsl().l)
    })

    test('lighten increases lightness', () => {
      const original = colord('#ec8b8b')
      const lightened = original.lighten(0.1)
      expect(lightened.toHsl().l).toBeGreaterThan(original.toHsl().l)
    })

    test('darken preserves alpha', () => {
      const c = colord('#ff0000').alpha(0.5).darken(0.2)
      expect(c.alpha()).toBeCloseTo(0.5, 1)
    })

    test('mix blends two colors', () => {
      const mixed = colord('#000000').mix('#ffffff', 0.5)
      const { r, g, b } = mixed.toRgb()
      expect(r).toBeCloseTo(128, 0)
      expect(g).toBeCloseTo(128, 0)
      expect(b).toBeCloseTo(128, 0)
    })

    test('mix with string argument', () => {
      const mixed = colord('#ff0000').mix('blue', 0.5)
      expect(mixed.toRgb().r).toBeCloseTo(128, 0)
      expect(mixed.toRgb().b).toBeCloseTo(128, 0)
    })
  })

  describe('hexToGLrgb', () => {
    test('converts hex to GL floats', () => {
      const [r, g, b] = hexToGLrgb('#ff0000')
      expect(r).toBeCloseTo(1)
      expect(g).toBeCloseTo(0)
      expect(b).toBeCloseTo(0)
    })

    test('handles grey', () => {
      const [r, g, b] = hexToGLrgb('#808080')
      expect(r).toBeCloseTo(128 / 255)
      expect(g).toBeCloseTo(128 / 255)
      expect(b).toBeCloseTo(128 / 255)
    })

    test('handles short hex', () => {
      const [r, g, b] = hexToGLrgb('#fff')
      expect(r).toBeCloseTo(1)
      expect(g).toBeCloseTo(1)
      expect(b).toBeCloseTo(1)
    })
  })
})
