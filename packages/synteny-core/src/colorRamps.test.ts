import { colorRampStops, sampleColorRamp } from '@jbrowse/core/util/colorRamp'
import { UNIVERSAL_FIELD_PRESETS } from '@jbrowse/core/util/colorScale'

import {
  dnDsRatio,
  rampNorm,
  resolveNumericMode,
  strandLevels,
} from './colorRamps.ts'

import type { AttributeRange, SyntenyColorPaint } from './colorRamps.ts'

const feat = (attrs: Record<string, unknown>) => ({
  get: (key: string) => attrs[key],
})

function ramp(
  field: string,
  ranges?: Record<string, AttributeRange>,
  paint?: SyntenyColorPaint,
) {
  const mode = resolveNumericMode(field, ranges, paint)
  if (mode?.scale !== 'linear') {
    throw new Error(`${field} paints no ramp`)
  }
  return mode
}

// The whole reason dN/dS gets a diverging ramp rather than riding the identity
// one: 1 is the neutral expectation, and a reader is looking for which side of
// it a gene falls on. If 1 is not the ramp's own middle, the pale band lands
// somewhere arbitrary and the color stops meaning anything.
test('the dN/dS ramp puts 1 at its own middle', () => {
  const dnds = ramp('dnds')
  expect(rampNorm(dnds, 1)).toBe(0.5)
  expect(rampNorm(dnds, 0)).toBe(0)
  expect(rampNorm(dnds, 0.5)).toBe(0.25)
  expect(rampNorm(dnds, 1.5)).toBe(0.75)
  expect(rampNorm(dnds, 2)).toBe(1)
})

// Almost every gene sits far below 1, so a domain stretched to a handful of
// fast-evolving outliers would flatten the rest into one blue.
test('dN/dS past the domain top clamps rather than escaping the ramp', () => {
  expect(rampNorm(ramp('dnds'), 10)).toBe(1)
  expect(rampNorm(ramp('dnds'), 1e6)).toBe(1)
})

test('identity reads across its own fraction', () => {
  expect(rampNorm(ramp('identity'), 0.5)).toBe(0.5)
  expect([ramp('identity').minLabel, ramp('identity').maxLabel]).toEqual([
    '0%',
    '100%',
  ])
})

// A diverging quantity needs its middle visible, so this ramp is deliberately
// not monotonic in luminance the way viridis/cividis are. The pale middle IS
// the pivot marker, since the legend labels only the two ends.
test('the dN/dS ramp runs cool to pale to hot', () => {
  const { stops } = ramp('dnds')
  const [lowR, , lowB] = sampleColorRamp(stops, 0)
  const [midR, midG] = sampleColorRamp(stops, 0.5)
  const [hiR, , hiB] = sampleColorRamp(stops, 1)
  expect(lowB).toBeGreaterThan(lowR)
  expect(hiR).toBeGreaterThan(hiB)
  expect(Math.min(midR, midG)).toBeGreaterThan(200)
})

// The alignments display's mapq paints these bins, so a synteny view coloring
// the same PAF by the same field says the same thing.
test('mapq paints the alignments bins in cividis', () => {
  const mode = resolveNumericMode('mapq', { mappingQual: { min: 0, max: 60 } })
  expect(mode).toMatchObject({
    scale: 'threshold',
    attribute: 'mappingQual',
    cuts: [1, 10, 30],
  })
  expect(mode?.scale === 'threshold' && mode.colors).toHaveLength(4)
})

test('a written linear scale runs mapq along a ramp over the values seen', () => {
  const mode = ramp(
    'mapq',
    { mappingQual: { min: 0, max: 60 } },
    { scale: 'linear' },
  )
  expect(mode.attribute).toBe('mappingQual')
  expect(rampNorm(mode, 30)).toBe(0.5)
})

test('a threshold bins a column at the cuts, spreading its scheme', () => {
  const mode = resolveNumericMode(
    'goc',
    { goc: { min: 0, max: 100 } },
    { scale: 'threshold', domain: ['50', '75'], scheme: 'viridis' },
  )
  expect(mode).toMatchObject({ scale: 'threshold', cuts: [50, 75] })
  const colors = mode?.scale === 'threshold' ? mode.colors : []
  expect(colors).toHaveLength(3)
  expect(colors[0]).not.toBe(colors[2])
})

test('dnDsRatio divides the two rates', () => {
  expect(dnDsRatio(feat({ dn: 0.02, ds: 0.4 }))).toBeCloseTo(0.05)
  expect(dnDsRatio(feat({ dn: 0.3, ds: 0.15 }))).toBe(2)
})

// Compara leaves a rate unestimated for a distant pair, and 0 there is a dN/dS
// of zero — total purifying selection — rather than "no measurement". A dS of 0
// is the same case: undefined, not infinite.
test('dnDsRatio answers NaN rather than a number it cannot support', () => {
  expect(dnDsRatio(feat({ dn: 0.02 }))).toBeNaN()
  expect(dnDsRatio(feat({ ds: 0.4 }))).toBeNaN()
  expect(dnDsRatio(feat({}))).toBeNaN()
  expect(dnDsRatio(feat({ dn: 0.02, ds: 0 }))).toBeNaN()
  expect(dnDsRatio(feat({ dn: 0.02, ds: 'NULL' }))).toBeNaN()
})

// The point of the whole exercise: a measurement nobody anticipated is reachable
// without an enum member, a menu entry, a legend arm, a LUT, a typed array and
// an RPC transfer slot of its own.
test('an attribute mode resolves for a column no preset knows about', () => {
  const mode = ramp('goc_score', { goc_score: { min: 0, max: 100 } })
  expect(mode.attribute).toBe('goc_score')
  expect(rampNorm(mode, 50)).toBe(0.5)
  expect(rampNorm(mode, 100)).toBe(1)
})

// A preset is a preset because it carries a domain a column name cannot supply,
// so the span the data happens to cover must not quietly rescale it.
test('a preset keeps its declared domain, a column takes the observed one', () => {
  const preset = ramp('identity', { identity: { min: 0.55, max: 0.6 } })
  expect(rampNorm(preset, 0.5)).toBe(0.5)
  const observed = ramp('goc', { goc: { min: 55, max: 60 } })
  expect(rampNorm(observed, 55)).toBe(0)
})

// The legend has to say what the ramp currently means, since an attribute scale
// is relative to what is in view.
test('an attribute ramp is labelled with its actual numbers', () => {
  const mode = ramp('dn', { dn: { min: 0, max: 0.0234567 } })
  expect([mode.minLabel, mode.maxLabel]).toEqual(['0', '0.0235'])
})

// One distinct value, or a column nothing carried: there is no gradient to
// place anything on, and dividing by the span would be a NaN across the view.
test('a flat or absent domain answers 0 rather than NaN', () => {
  expect(rampNorm(ramp('x', { x: { min: 3, max: 3 } }), 3)).toBe(0)
  expect(rampNorm(ramp('x'), 3)).toBe(0)
})

test('the constant and the structural fields are not numbers', () => {
  expect(resolveNumericMode('')).toBeUndefined()
  expect(resolveNumericMode('strand')).toBeUndefined()
  expect(resolveNumericMode('query')).toBeUndefined()
})

// The field is a plain string off a config, so an inherited member of the
// preset table would hand back Object.prototype's method as a preset.
test('a prototype member is a column, not a preset', () => {
  const mode = ramp('toString', { toString: { min: 0, max: 8 } })
  expect(mode.attribute).toBe('toString')
  expect(mode.maxValue).toBe(8)
})

describe('a declared ramp', () => {
  test("a scheme or range replaces a preset's stops, and reverse turns them round", () => {
    expect(ramp('identity', {}, { scheme: 'magma' }).stops).toEqual(
      colorRampStops({ scheme: 'magma' }),
    )
    expect(
      ramp('dn', { dn: { min: 0, max: 4 } }, { range: ['#000000', '#ffffff'] })
        .stops,
    ).toEqual([
      [0, 0, 0, 255],
      [255, 255, 255, 255],
    ])
    expect(ramp('dnds', {}, { reverse: true }).stops).toEqual(
      ramp('dnds').stops.toReversed(),
    )
  })

  test("a pinned end moves the domain and names itself in the preset's format", () => {
    const identity = ramp('identity', {}, { domainMin: 0.9 })
    expect([identity.minValue, identity.maxValue]).toEqual([0.9, 1])
    expect([identity.minLabel, identity.maxLabel]).toEqual(['90%', '100%'])
    expect(rampNorm(identity, 0.95)).toBeCloseTo(0.5)
  })

  test('an end pinned inside the values seen reads as at or beyond it', () => {
    const narrow = ramp('dn', { dn: { min: 0, max: 40 } }, { domainMax: 10 })
    expect([narrow.minValue, narrow.maxValue]).toEqual([0, 10])
    expect([narrow.minLabel, narrow.maxLabel]).toEqual(['0', '≥10'])
    const wide = ramp('dn', { dn: { min: 0, max: 4 } }, { domainMax: 10 })
    expect(wide.maxLabel).toBe('10')
  })

  test("domainMid places the middle stop, dnds's at 1 however far it runs", () => {
    expect(
      ramp('dn', { dn: { min: 0, max: 4 } }, { domainMid: 1 }).midNorm,
    ).toBeCloseTo(0.25)
    expect(ramp('dnds', {}, { domainMax: 4 }).midNorm).toBeCloseTo(0.25)
    expect(ramp('dn', { dn: { min: 0, max: 4 } }).midNorm).toBeUndefined()
  })

  test('a text column takes no ramp', () => {
    expect(
      resolveNumericMode(
        'group',
        { group: { labels: ['a'], colors: {} } },
        { scheme: 'magma' },
      ),
    ).toBeUndefined()
  })
})

describe('strand', () => {
  test("paints the universal preset's colors, unnamed", () => {
    const [forward, reverse] = UNIVERSAL_FIELD_PRESETS.strand.range
    expect(strandLevels({})).toEqual([
      { value: '1', color: forward, label: undefined },
      { value: '-1', color: reverse, label: undefined },
    ])
  })

  test('takes range in domain order and labels as names', () => {
    expect(
      strandLevels({ domain: ['-1', '1'], range: ['black', 'gold'] }, [
        'Reverse',
        'Forward',
      ]),
    ).toEqual([
      { value: '1', color: 'gold', label: 'Forward' },
      { value: '-1', color: 'black', label: 'Reverse' },
    ])
  })

  test("a range alone follows the preset's order, forward first", () => {
    expect(
      strandLevels({ range: ['gold', 'black'] }).map(l => l.color),
    ).toEqual(['gold', 'black'])
  })
})
