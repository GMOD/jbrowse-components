import { sampleColorRamp } from '@jbrowse/core/util/colorRamp'

import {
  DNDS_MAX,
  continuousRampConfig,
  dnDsRatio,
  rampNorm,
  resolveContinuousMode,
} from './colorRamps.ts'

const feat = (attrs: Record<string, unknown>) => ({
  get: (key: string) => attrs[key],
})

// The whole reason dN/dS gets a diverging ramp rather than riding the identity
// one: 1 is the neutral expectation, and a reader is looking for which side of
// it a gene falls on. If 1 is not the ramp's own middle, the pale band lands
// somewhere arbitrary and the color stops meaning anything.
test('the dN/dS ramp puts 1 at its own middle', () => {
  const { dnds } = continuousRampConfig
  expect(rampNorm(dnds, 1)).toBe(0.5)
  expect(rampNorm(dnds, 0)).toBe(0)
  expect(rampNorm(dnds, 0.5)).toBe(0.25)
  expect(rampNorm(dnds, 1.5)).toBe(0.75)
  expect(rampNorm(dnds, DNDS_MAX)).toBe(1)
})

// Almost every gene sits far below 1, so a domain stretched to a handful of
// fast-evolving outliers would flatten the rest into one blue.
test('dN/dS past the domain top clamps rather than escaping the ramp', () => {
  expect(rampNorm(continuousRampConfig.dnds, 10)).toBe(1)
  expect(rampNorm(continuousRampConfig.dnds, 1e6)).toBe(1)
})

// rampNorm is the single place a value is placed on a ramp — the
// linear-synteny LUT and the dotplot's per-feature evaluation both go through
// it, and they have already disagreed once over MAPQ scaling.
test('rampNorm reads each preset across its own domain, clamped', () => {
  expect(rampNorm(continuousRampConfig.identity, 0.5)).toBe(0.5)
  expect(rampNorm(continuousRampConfig.mapq, 30)).toBe(0.5)
  // clamped, which is the piece the dotplot used to omit
  expect(rampNorm(continuousRampConfig.mapq, 600)).toBe(1)
})

// A diverging quantity needs its middle visible, so this ramp is deliberately
// not monotonic in luminance the way viridis/cividis are. The pale middle IS
// the pivot marker, since the legend labels only the two ends.
test('the dN/dS ramp runs cool to pale to hot', () => {
  const { stops } = continuousRampConfig.dnds
  const [lowR, , lowB] = sampleColorRamp(stops, 0)
  const [midR, midG] = sampleColorRamp(stops, 0.5)
  const [hiR, , hiB] = sampleColorRamp(stops, 1)
  expect(lowB).toBeGreaterThan(lowR)
  expect(hiR).toBeGreaterThan(hiB)
  expect(Math.min(midR, midG)).toBeGreaterThan(200)
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
  const mode = resolveContinuousMode('goc_score', {
    goc_score: { min: 0, max: 100 },
  })
  expect(mode?.attribute).toBe('goc_score')
  expect(rampNorm(mode!, 50)).toBe(0.5)
  expect(rampNorm(mode!, 100)).toBe(1)
})

// A preset is a preset because it carries a domain a column name cannot supply,
// so the span the data happens to cover must not quietly rescale it.
test('a preset keeps its declared domain, a column takes the observed one', () => {
  const preset = resolveContinuousMode('mapq', {
    mappingQual: { min: 55, max: 60 },
  })
  expect(rampNorm(preset!, 30)).toBe(0.5)
  const observed = resolveContinuousMode('goc', { goc: { min: 55, max: 60 } })
  expect(rampNorm(observed!, 55)).toBe(0)
})

// The legend has to say what the ramp currently means, since an attribute scale
// is relative to what is in view.
test('an attribute ramp is labelled with its actual numbers', () => {
  const mode = resolveContinuousMode('dn', {
    dn: { min: 0, max: 0.0234567 },
  })
  expect([mode?.minLabel, mode?.maxLabel]).toEqual(['0', '0.0235'])
})

// One distinct value, or a column nothing carried: there is no gradient to
// place anything on, and dividing by the span would be a NaN across the view.
test('a flat or absent domain answers 0 rather than NaN', () => {
  const flat = resolveContinuousMode('x', { x: { min: 3, max: 3 } })
  expect(rampNorm(flat!, 3)).toBe(0)
  const absent = resolveContinuousMode('x')
  expect(rampNorm(absent!, 3)).toBe(0)
})

test('the constant is not a continuous field', () => {
  expect(resolveContinuousMode('')).toBeUndefined()
})

// The field is a plain string off a config, so an inherited member of the
// preset table would hand back Object.prototype's method as a ramp and throw
// inside the LUT.
test('a prototype member is a column, not a preset', () => {
  const mode = resolveContinuousMode('toString', {
    toString: { min: 0, max: 8 },
  })
  expect(mode?.attribute).toBe('toString')
  expect(mode?.maxValue).toBe(8)
})
