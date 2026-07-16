import {
  cssColorToABGR,
  cssColorToNormalizedRgb,
  cssColorToNormalizedRgba,
  cssColorToRgba,
  featureBedColor,
  featureItemRgb,
  getAlpha,
  getBlue,
  getGreen,
  getRed,
  parseCssColor,
} from './colorBits.ts'

import type { Feature } from './simpleFeature.ts'

describe('colorBits helpers', () => {
  describe('parseCssColor', () => {
    test('hex colors', () => {
      const c = parseCssColor('#ff0000')
      expect(getRed(c)).toBe(255)
      expect(getGreen(c)).toBe(0)
      expect(getBlue(c)).toBe(0)
      expect(getAlpha(c)).toBe(255)
    })

    test('3-digit hex #RGB shorthand', () => {
      const c = parseCssColor('#f00')
      expect(getRed(c)).toBe(255)
      expect(getGreen(c)).toBe(0)
      expect(getBlue(c)).toBe(0)
      expect(getAlpha(c)).toBe(255)
    })

    test('4-digit hex #RGBA shorthand (CSS Color Level 4)', () => {
      // #ff0a = yellow (255,255,0) with alpha 0xaa
      const yellow = parseCssColor('#ff0a')
      expect(getRed(yellow)).toBe(255)
      expect(getGreen(yellow)).toBe(255)
      expect(getBlue(yellow)).toBe(0)
      expect(getAlpha(yellow)).toBe(0xaa)

      // #00fa = blue (0,0,255) with alpha 0xaa
      const blue = parseCssColor('#00fa')
      expect(getRed(blue)).toBe(0)
      expect(getGreen(blue)).toBe(0)
      expect(getBlue(blue)).toBe(255)
      expect(getAlpha(blue)).toBe(0xaa)
    })

    test('8-digit hex #RRGGBBAA', () => {
      const c = parseCssColor('#ff000080')
      expect(getRed(c)).toBe(255)
      expect(getGreen(c)).toBe(0)
      expect(getBlue(c)).toBe(0)
      expect(getAlpha(c)).toBe(0x80)
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

    test('bare BED itemRgb triple', () => {
      // BED-family adapters put itemRgb on the feature verbatim as "r,g,b",
      // which is not a CSS color; parsing it directly means a feature attribute
      // can be used as a color with no rgb() wrapping in the config
      const c = parseCssColor('227,26,28')
      expect(getRed(c)).toBe(227)
      expect(getGreen(c)).toBe(26)
      expect(getBlue(c)).toBe(28)
      expect(getAlpha(c)).toBe(255)
    })

    test('itemRgb-shaped garbage still returns the magenta sentinel', () => {
      expect(getGreen(parseCssColor('1,2'))).toBe(0)
      expect(getGreen(parseCssColor('1,2,3,4'))).toBe(0)
      expect(getGreen(parseCssColor('a,b,c'))).toBe(0)
    })

    test('an out-of-range triple is magenta, not a wrapped color', () => {
      // 999 & 0xFF is 231, so masking would paint #e70000 and look deliberate
      const c = parseCssColor('999,0,0')
      expect([getRed(c), getGreen(c), getBlue(c)]).toEqual([255, 0, 255])
    })

    test('a spaced triple parses, matching featureItemRgb', () => {
      const c = parseCssColor('255, 0, 0')
      expect([getRed(c), getGreen(c), getBlue(c)]).toEqual([255, 0, 0])
    })

    test('case insensitive named colors', () => {
      expect(getRed(parseCssColor('RED'))).toBe(255)
      expect(getRed(parseCssColor('Red'))).toBe(255)
    })

    test('undefined / null / empty returns magenta sentinel without throwing', () => {
      // user jexl callbacks that return undefined would otherwise crash the
      // worker on `undefined.trim()` (see #4181 follow-up)
      const c1 = parseCssColor(undefined)
      expect(getRed(c1)).toBe(255)
      expect(getGreen(c1)).toBe(0)
      expect(getBlue(c1)).toBe(255)
      expect(getRed(parseCssColor(null))).toBe(255)
      expect(getRed(parseCssColor(''))).toBe(255)
    })

    test('malformed-but-nonempty strings return magenta sentinel without throwing', () => {
      // an empty itemRgb yields "rgb()", which must degrade to magenta rather
      // than throw and crash the render. (A *populated* itemRgb triple like
      // "255,0,0" is understood — see the bare BED itemRgb test above.)
      for (const bad of ['rgb()', 'not-a-color', 'rgb(1,2)']) {
        const c = parseCssColor(bad)
        expect([getRed(c), getGreen(c), getBlue(c)]).toEqual([255, 0, 255])
      }
    })
  })

  describe('featureItemRgb', () => {
    test('a real triple passes through', () => {
      expect(featureItemRgb('227,26,28')).toBe('227,26,28')
      expect(featureItemRgb(' 227,26,28 ')).toBe('227,26,28')
    })

    test('the "no color specified" placeholder reads as absent', () => {
      // plain BED12 files fill itemRgb with this rather than omitting it (every
      // itemRgb in the volvox-bed12 fixture is "0,0,0"); honoring it literally
      // would paint an ordinary BED12 track solid black
      expect(featureItemRgb('0')).toBeUndefined()
      expect(featureItemRgb('0,0,0')).toBeUndefined()
    })

    test('missing / non-string / empty reads as absent', () => {
      expect(featureItemRgb(undefined)).toBeUndefined()
      expect(featureItemRgb('')).toBeUndefined()
      expect(featureItemRgb(0)).toBeUndefined()
    })

    test('anything not unambiguously a BED triple reads as absent', () => {
      // this feeds an automatic path, so a non-triple must leave the configured
      // default alone rather than resolve to the magenta invalid sentinel — a
      // `reserved` column need not hold a color at all
      expect(featureItemRgb('#ff0000')).toBeUndefined()
      expect(featureItemRgb('red')).toBeUndefined()
      expect(featureItemRgb('some_label')).toBeUndefined()
      expect(featureItemRgb('1,2')).toBeUndefined()
    })

    test('an out-of-range component reads as absent, never a wrapped color', () => {
      // the parser masks to 8 bits, so claiming "999,0,0" would paint 231,0,0 —
      // a plausible-looking but wrong color
      expect(featureItemRgb('999,0,0')).toBeUndefined()
      expect(featureItemRgb('256,0,0')).toBeUndefined()
    })

    test('spaces are tolerated, and the triple comes back canonical', () => {
      // the spec has no spaces, but ignoring an otherwise-usable color is worse
      expect(featureItemRgb('255, 0, 0')).toBe('255,0,0')
      expect(featureItemRgb(' 227,26,28 ')).toBe('227,26,28')
    })
  })

  describe('featureBedColor', () => {
    function mockFeature(attrs: Record<string, unknown>) {
      return { get: (k: string) => attrs[k] } as unknown as Feature
    }

    test('reads the itemRgb column', () => {
      expect(featureBedColor(mockFeature({ itemRgb: '227,26,28' }))).toBe(
        '227,26,28',
      )
    })

    test('reads the reserved column, which is what bigBed autoSql names it', () => {
      // BigBedAdapter takes its field names from the file's embedded autoSql,
      // and UCSC's canonical BED autoSql calls the color column `reserved` —
      // our own volvox.bb features come out with it
      expect(featureBedColor(mockFeature({ reserved: '31,120,180' }))).toBe(
        '31,120,180',
      )
    })

    test('itemRgb wins when a file somehow carries both', () => {
      expect(
        featureBedColor(mockFeature({ itemRgb: '1,1,1', reserved: '2,2,2' })),
      ).toBe('1,1,1')
    })

    test('falls through a placeholder in one column to a real color in the other', () => {
      expect(
        featureBedColor(mockFeature({ itemRgb: '0,0,0', reserved: '2,2,2' })),
      ).toBe('2,2,2')
    })

    test('a reserved column holding a non-color reads as absent', () => {
      expect(featureBedColor(mockFeature({ reserved: 'foo' }))).toBeUndefined()
    })

    test('no color columns at all', () => {
      expect(featureBedColor(mockFeature({ name: 'x' }))).toBeUndefined()
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

  describe('cssColorToABGR', () => {
    // ABGR layout: R in bits 0-7, G in bits 8-15, B in bits 16-23, A in bits 24-31

    test('red', () => {
      expect(cssColorToABGR('red')).toBe(0xff0000ff)
    })

    test('blue', () => {
      // R=0, G=0, B=255, A=255 → 0xFFFF0000
      expect(cssColorToABGR('blue')).toBe(0xffff0000)
    })

    test('transparent packs to 0', () => {
      expect(cssColorToABGR('transparent')).toBe(0)
    })

    test('always returns a non-negative uint32 for fully opaque colors', () => {
      // JS << 24 with alpha=255 produces a negative signed int32 without >>> 0
      expect(cssColorToABGR('red')).toBeGreaterThanOrEqual(0)
      expect(cssColorToABGR('blue')).toBeGreaterThanOrEqual(0)
      expect(cssColorToABGR('white')).toBeGreaterThanOrEqual(0)
    })

    test('semi-transparent color round-trips channel values', () => {
      const packed = cssColorToABGR('#ff000080')
      expect(packed & 0xff).toBe(255) // R
      expect((packed >> 8) & 0xff).toBe(0) // G
      expect((packed >> 16) & 0xff).toBe(0) // B
      expect((packed >>> 24) & 0xff).toBe(0x80) // A
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
