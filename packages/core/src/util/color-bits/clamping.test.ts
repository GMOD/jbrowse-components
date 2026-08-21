import { alpha, blend, darken, lighten, parse, toRGBA } from './index.ts'

// The vendored composition is `(r << 24) + (g << 16) + (b << 8) + a`, which
// wraps each channel and then carries the overflow into its neighbour, and
// `set` masked rather than clamped. Both are local edits now, so these are the
// cases that say the edits are still there — every one of them produced a
// plausible wrong colour before, never a throw, so nothing else would notice.

const RED = '#ff0000'

describe('an out-of-range channel clamps, and never bleeds into its neighbour', () => {
  it('over-driven rgb saturates instead of wrapping to near-black', () => {
    expect(toRGBA(parse('rgb(110%, 0%, 0%)'))).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 255,
    })
    expect(toRGBA(parse('rgb(300,0,0)'))).toEqual({
      r: 255,
      g: 0,
      b: 0,
      a: 255,
    })
  })

  it('a negative alpha stays transparent black rather than composing to white', () => {
    expect(toRGBA(parse('rgb(0 0 0 / -20%)'))).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0,
    })
  })

  it('alpha() past full opacity saturates — jexl alpha(color, n) reaches this', () => {
    expect(toRGBA(alpha(parse(RED), 1.4)).a).toBe(255)
    expect(toRGBA(alpha(parse(RED), -0.2)).a).toBe(0)
  })

  // NaN fails every comparison, so a `< 0`/`> 255` pair returned it unchanged
  // and the shift turned it into 0 — one channel, silently
  it('a NaN channel clamps like any other out-of-range one', () => {
    expect(toRGBA(alpha(parse(RED), Number.NaN)).a).toBe(0)
    expect(toRGBA(alpha(parse(RED), Number.NaN)).r).toBe(255)
  })

  it('a coefficient past 1 saturates instead of turning red into teal', () => {
    expect(toRGBA(lighten(parse(RED), 1.5))).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 255,
    })
    expect(toRGBA(darken(parse(RED), 1.5))).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 255,
    })
  })

  it('leaves every in-range value exactly where it was', () => {
    expect(toRGBA(alpha(parse(RED), 0.5)).a).toBe(128)
    // truncating, not rounding: `<<` did that before the clamp and still does,
    // which is what keeps this matching MUI's own darken
    expect(toRGBA(darken(parse('#ffffff'), 0.5))).toEqual({
      r: 127,
      g: 127,
      b: 127,
      a: 255,
    })
    expect(toRGBA(parse('#3a7bd5aa'))).toEqual({
      r: 58,
      g: 123,
      b: 213,
      a: 170,
    })
  })
})

describe('hue is periodic, in every syntax that takes one', () => {
  const red = { r: 255, g: 0, b: 0, a: 255 }
  const green = { r: 0, g: 255, b: 0, a: 255 }

  it('agrees with a browser past a full turn, in both directions', () => {
    expect(toRGBA(parse('hsl(0, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hsl(360deg, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hsl(720deg, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hsl(-720deg, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hsl(120, 100%, 50%)'))).toEqual(green)
    expect(toRGBA(parse('hsl(480deg, 100%, 50%)'))).toEqual(green)
  })

  // Each of these is PAST a full turn in its own unit, which is what the fold
  // is for. Inside one turn every unit agrees with a browser without it —
  // `hueToRGB` corrects its argument by at most one turn on its own — so
  // `0.5turn` against `180deg`, and any oklch pair (whose hue never reaches
  // `parseAngle` at all), pass with the fold deleted.
  it('folds the other angle units past a full turn too', () => {
    expect(toRGBA(parse('hsl(2turn, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hsl(-2turn, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hsl(800grad, 100%, 50%)'))).toEqual(red)
    expect(toRGBA(parse('hwb(2turn 0% 0%)'))).toEqual(red)
  })
})

// Same class again: a wrong answer that looks like a right one. The whole string
// has to be the colour, or the invalid-colour sentinel `colorBits.test.ts`
// asserts ("a broken config reads as magenta, never as a plausible wrong
// colour") is unreachable for anything with a colour buried in it.
describe('a colour is the whole string, not something found inside one', () => {
  it('refuses a colour with anything around it', () => {
    expect(() => parse('foo rgb(1,2,3) bar')).toThrow(/invalid CSS color/)
    expect(() => parse('rgb(1,2,3) rgb(4,5,6)')).toThrow(/invalid CSS color/)
    expect(() => parse('url(rgb(1,2,3))')).toThrow(/invalid CSS color/)
  })

  it('still tolerates surrounding whitespace, which is a formatting slip', () => {
    expect(toRGBA(parse('  rgb(255, 0, 0)  '))).toEqual(toRGBA(parse(RED)))
  })
})

// `blend` is what `colord().mix()` is, and mix is on the public colord-shaped
// surface, so it has to carry alpha the way the real one does.
describe('mixing carries the operands alpha', () => {
  it('interpolates alpha rather than forcing opaque', () => {
    const transparent = parse('rgba(255,0,0,0)')
    expect(toRGBA(blend(transparent, parse(RED), 0.5)).a).toBe(128)
    expect(toRGBA(blend(transparent, parse(RED), 1)).a).toBe(255)
    expect(toRGBA(blend(transparent, parse(RED), 0)).a).toBe(0)
  })

  it('leaves two opaque operands opaque, which is every in-tree caller', () => {
    expect(toRGBA(blend(parse(RED), parse('#0000ff'), 0.5))).toEqual({
      r: 128,
      g: 0,
      b: 128,
      a: 255,
    })
  })
})
