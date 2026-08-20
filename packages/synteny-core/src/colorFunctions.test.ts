import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  MISSING_VALUE_COLOR,
  createComparativeColorFunction,
  makeNameColorFunction,
  paletteColorAt,
} from './colorFunctions.ts'

import type { ColorFunctionInputs } from './colorFunctions.ts'

function inputs(over: Partial<ColorFunctionInputs> = {}): ColorFunctionInputs {
  return {
    strands: new Int8Array([1]),
    refNameDict: ['chr1'],
    refNameIds: new Uint32Array([0]),
    mateRefNameDict: ['chr1'],
    mateRefNameIds: new Uint32Array([0]),
    attributes: {},
    ...over,
  }
}

// The reason this module exists. Both views used to declare their own palette
// under a comment claiming the two could not drift, and they had: synteny handed
// out palette positions by chromosome, dotplot hashed into nine buckets. Nothing
// caught it because nothing compared them.
describe('chromosome painting', () => {
  const karyotype = Array.from({ length: 24 }, (_, i) => `chr${i + 1}`)

  test('distinct colors well past nine, where a nine-bucket hash collides', () => {
    const ids = new Uint32Array(karyotype.map((_, i) => i))
    const fn = makeNameColorFunction(karyotype, ids, karyotype)
    const colors = new Set(karyotype.map((_, i) => fn(i)))
    expect(colors.size).toBe(karyotype.length)
  })

  // Rice is the case a figure review actually caught: twelve chromosomes into
  // nine slots is a guaranteed three-way collision by pigeonhole.
  test('a rice karyotype paints twelve distinct colors', () => {
    const rice = karyotype.slice(0, 12)
    const fn = makeNameColorFunction(
      rice,
      new Uint32Array(rice.map((_, i) => i)),
      rice,
    )
    expect(new Set(rice.map((_, i) => fn(i))).size).toBe(12)
  })

  // Three laps of nine, then the tones start again — a repeat 27 positions away
  // is one no reader is comparing.
  test('the palette laps at 27, not at 9', () => {
    expect(paletteColorAt(0)).not.toBe(paletteColorAt(9))
    expect(paletteColorAt(0)).not.toBe(paletteColorAt(18))
    expect(paletteColorAt(0)).toBe(paletteColorAt(27))
  })

  // Without an order there is nothing to hand out positions from, so the hash is
  // the answer — an assembly still loading, or a scaffold the assembly does not
  // list. Stable, and stable across the two views because it is one function.
  test('falls back to the hash with no order, and to it per-name with a partial one', () => {
    const dict = ['chr1', 'scaffold_77']
    const ids = new Uint32Array([0, 1])
    const hashed = makeNameColorFunction(dict, ids)
    const partial = makeNameColorFunction(dict, ids, ['chr1'])
    // chr1 is in the order, so it takes its POSITION's palette color — asserted
    // against a moved position, since chr1's hash bucket happens to be 0 too and
    // position 0 alone would pass either way
    expect(partial(0)).toBe(paletteColorAt(0))
    const moved = makeNameColorFunction(dict, ids, ['a', 'b', 'c', 'd', 'chr1'])
    expect(moved(0)).toBe(paletteColorAt(4))
    expect(moved(0)).not.toBe(hashed(0))
    // the scaffold is in neither order, so all three answer with the same hash
    expect(partial(1)).toBe(hashed(1))
    expect(moved(1)).toBe(hashed(1))
  })
})

describe('createComparativeColorFunction', () => {
  // The one thing the two views legitimately disagree on, and therefore the one
  // thing that is a parameter rather than a constant.
  test('only the unpainted default differs between the two views', () => {
    const data = inputs()
    const ribbon = createComparativeColorFunction({
      colorBy: 'default',
      data,
      trackColor: '#123456',
      defaultColor: MISSING_VALUE_COLOR,
      attributeRanges: {},
    })
    const point = createComparativeColorFunction({
      colorBy: 'default',
      data,
      trackColor: '#123456',
      defaultColor: 0xff000000,
      attributeRanges: {},
    })
    expect(abgrToCssRgba(ribbon(0))).toBe('rgba(255,0,0,1)')
    expect(abgrToCssRgba(point(0))).toBe('rgba(0,0,0,1)')

    // and every other mode answers identically whatever the default is
    for (const colorBy of ['strand', 'track', 'query', 'target'] as const) {
      const a = createComparativeColorFunction({
        colorBy,
        data,
        trackColor: '#123456',
        defaultColor: MISSING_VALUE_COLOR,
        attributeRanges: {},
      })
      const b = createComparativeColorFunction({
        colorBy,
        data,
        trackColor: '#123456',
        defaultColor: 0xff000000,
        attributeRanges: {},
      })
      expect(a(0)).toBe(b(0))
    }
  })

  // `rampNorm` clamps to [0,1] itself only when the mode has no custom
  // `normalize`, so the LUT index is clamped on both ends here. Unclamped, an
  // out-of-domain value reads past the LUT (or, negative, truncates to a
  // negative index), gets `undefined`, and a Uint32Array store writes that as 0
  // — a transparent black feature, silently.
  test('an out-of-domain continuous value stays inside the LUT', () => {
    const data = inputs({
      attributes: { identity: new Float32Array([0, 0.5, 1, 99]) },
      strands: new Int8Array([1, 1, 1, 1]),
      refNameIds: new Uint32Array([0, 0, 0, 0]),
      mateRefNameIds: new Uint32Array([0, 0, 0, 0]),
    })
    const fn = createComparativeColorFunction({
      colorBy: 'identity',
      data,
      trackColor: '#123456',
      defaultColor: MISSING_VALUE_COLOR,
      attributeRanges: {},
    })
    for (const i of [0, 1, 2, 3]) {
      expect(Number.isInteger(fn(i))).toBe(true)
    }
    // clamped to the ramp's top rather than read off the end
    expect(fn(3)).toBe(fn(2))
  })

  test('a missing value paints the missing color, not the ramp bottom', () => {
    const data = inputs({
      attributes: { identity: new Float32Array([-1, 0]) },
      strands: new Int8Array([1, 1]),
      refNameIds: new Uint32Array([0, 0]),
      mateRefNameIds: new Uint32Array([0, 0]),
    })
    const fn = createComparativeColorFunction({
      colorBy: 'identity',
      data,
      trackColor: '#123456',
      defaultColor: 0xff000000,
      attributeRanges: {},
    })
    expect(fn(0)).toBe(MISSING_VALUE_COLOR)
    expect(fn(1)).not.toBe(MISSING_VALUE_COLOR)
  })

  // The domain an `attribute:<name>` ramp scales to is the CALLER'S, which is
  // what stops a pan from re-coloring what is already on screen: a fetch's
  // payload only knows the span of the slice it holds, and the view accumulates
  // one that settles. Two calls over the same values under two domains have to
  // answer differently, or the domain is not being read.
  test('an attribute ramp scales to the domain it is handed', () => {
    const data = inputs({
      attributes: { goc: new Float32Array([50]) },
      strands: new Int8Array([1]),
      refNameIds: new Uint32Array([0]),
      mateRefNameIds: new Uint32Array([0]),
    })
    const at = (
      attributeRanges: Record<string, { min: number; max: number }>,
    ) =>
      createComparativeColorFunction({
        colorBy: 'attribute:goc',
        data,
        trackColor: '#123456',
        defaultColor: 0,
        attributeRanges,
      })(0)
    // top of a domain that ends at 50, middle of one that ends at 100
    expect(at({ goc: { min: 0, max: 50 } })).not.toBe(
      at({ goc: { min: 0, max: 100 } }),
    )
    expect(at({ goc: { min: 0, max: 50 } })).toBe(
      at({ goc: { min: 0, max: 50 } }),
    )
  })

  // 'reference' is a stacked-view mode each synteny level resolves before it
  // gets here, and a two-genome dotplot has no anchor for it at all.
  test('reference falls back to query on both sides', () => {
    const data = inputs({
      refNameDict: ['chrA'],
      mateRefNameDict: ['chrB'],
    })
    const args = {
      data,
      trackColor: '#123456',
      defaultColor: 0,
      attributeRanges: {},
    }
    expect(
      createComparativeColorFunction({ ...args, colorBy: 'reference' })(0),
    ).toBe(createComparativeColorFunction({ ...args, colorBy: 'query' })(0))
  })
})
