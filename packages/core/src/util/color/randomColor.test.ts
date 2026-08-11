import { parse, toRGBA } from '../color-bits/index.ts'
import { randomColor } from './index.ts'

// OKLCH lightness/chroma of a color, so the tests can assert on what the hash
// actually controls rather than on the hex it happens to print.
function oklch(color: string) {
  const { r, g, b } = toRGBA(parse(color))
  const lin = (v: number) => {
    const c = v / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [R, G, B] = [lin(r), lin(g), lin(b)]
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(A, Bb) }
}

const SAMPLES = [
  'prfB',
  'fliR',
  'efp',
  'psel',
  'lysS',
  'ompA',
  'clpB',
  'flaA',
  'cagA',
  'vacA',
  'ureA',
  'babA',
]

describe('randomColor', () => {
  test('is deterministic and stateless (same string -> same color)', () => {
    expect(randomColor('flaA')).toBe(randomColor('flaA'))
    expect(randomColor('flaA')).not.toBe(randomColor('flaB'))
  })

  // The everyday caller is the Color-by-attribute dialog, over a whole track
  // where most files carry the attribute on some features and not others. This
  // used to throw on the undefined, once per feature, and every unlabelled
  // feature came out one strong color — a large fake category drawn over the
  // real ones. Grey, and the same grey for all three ways of having no value.
  test('paints a missing value neutral rather than hashing it', () => {
    const grey = randomColor(undefined)
    expect(grey).toMatch(/^#[0-9a-f]{6}$/)
    expect(randomColor(null)).toBe(grey)
    expect(randomColor('')).toBe(grey)
    const { C } = oklch(grey)
    // unsaturated, so it cannot be mistaken for one more member of a palette
    // whose every member is equally colorful
    expect(C).toBeLessThan(0.02)
    for (const str of SAMPLES) {
      expect(randomColor(str)).not.toBe(grey)
    }
  })

  test('emits a parseable hex color', () => {
    for (const str of ['a', 'prfB', 'C694_RS00885', 'a longer string!']) {
      expect(randomColor(str)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  // The point of hashing into OKLCH rather than HSL: every value comes out
  // equally light and equally colorful, which is what a hand-picked
  // categorical palette buys and what an HSL hash cannot give (its yellows
  // glare and its blues go murky at one nominal lightness).
  test('holds lightness and chroma in the categorical band', () => {
    for (const str of SAMPLES) {
      const { L, C } = oklch(randomColor(str))
      // the three tiers span 0.56-0.75; allow for the 8-bit round trip
      expect(L).toBeGreaterThan(0.5)
      expect(L).toBeLessThan(0.8)
      // colorful enough to be a color, never a neon
      expect(C).toBeGreaterThan(0.05)
      expect(C).toBeLessThan(0.2)
    }
  })

  // The reason this stays a hash into a color space instead of becoming an
  // index into a curated list of N: with no shared state there is no allocator
  // to hand out "the next unused color", so an N-color palette would repeat
  // itself after N values and collide by the birthday problem well before
  // that. The hue circle does not.
  test('keeps hundreds of values apart, as a fixed palette could not', () => {
    const many = Array.from({ length: 500 }, (_, i) => `gene${i}`)
    expect(new Set(many.map(randomColor)).size).toBeGreaterThan(300)
    expect(new Set(SAMPLES.map(randomColor)).size).toBe(SAMPLES.length)
  })

  test('varies the lightness/chroma tier across values, not just hue', () => {
    const tiers = new Set(
      SAMPLES.map(str => oklch(randomColor(str)).L.toFixed(2)),
    )
    // a single-tier hash would collapse this to one entry
    expect(tiers.size).toBeGreaterThan(1)
  })
})
