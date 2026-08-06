import {
  DNDS_MAX,
  DNDS_PIVOT,
  continuousRampConfig,
  dnDsRatio,
  dndsNorm,
  rampNorm,
  resolveContinuousMode,
} from './colorRamps.ts'

const feat = (attrs: Record<string, unknown>) => ({
  get: (key: string) => attrs[key],
})

// The whole reason dN/dS gets a diverging ramp rather than riding the identity
// one: 1 is the neutral expectation, and a reader is looking for which side of
// it a gene falls on. If the pivot is not the ramp's own middle, the pale band
// lands somewhere arbitrary and the color stops meaning anything.
test('the dN/dS ramp pivots at 1, in its own middle', () => {
  expect(dndsNorm(DNDS_PIVOT)).toBe(0.5)
  expect(dndsNorm(0)).toBe(0)
  expect(dndsNorm(0.5)).toBe(0.25)
  expect(dndsNorm(1.5)).toBe(0.75)
  expect(dndsNorm(DNDS_MAX)).toBe(1)
})

// Almost every gene sits far below 1, so a domain stretched to a handful of
// fast-evolving outliers would flatten the rest into one blue.
test('dN/dS past the domain top clamps rather than escaping the ramp', () => {
  expect(dndsNorm(10)).toBe(1)
  expect(dndsNorm(1e6)).toBe(1)
})

// rampNorm is the single place the choice between "divide by the top" and a
// mode's own normalization is made — the linear-synteny LUT and the dotplot's
// per-feature evaluation both go through it, and they have already disagreed
// once over MAPQ scaling.
test('rampNorm divides for the plain modes and defers for the diverging one', () => {
  expect(rampNorm(continuousRampConfig.identity, 0.5)).toBe(0.5)
  expect(rampNorm(continuousRampConfig.mappingQuality, 30)).toBe(0.5)
  // clamped, which is the piece the dotplot used to omit
  expect(rampNorm(continuousRampConfig.mappingQuality, 600)).toBe(1)
  expect(rampNorm(continuousRampConfig.dnds, DNDS_PIVOT)).toBe(0.5)
})

// A diverging quantity needs its middle visible, so this ramp is deliberately
// not monotonic in luminance the way viridis/cividis are. The pale middle IS
// the pivot marker, since the legend labels only the two ends.
test('the dN/dS ramp runs cool to pale to hot', () => {
  const { toRgb } = continuousRampConfig.dnds
  const [lowR, , lowB] = toRgb(0)
  const [midR, midG] = toRgb(0.5)
  const [hiR, , hiB] = toRgb(1)
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
test('dnDsRatio answers -1 rather than a number it cannot support', () => {
  expect(dnDsRatio(feat({ dn: 0.02 }))).toBe(-1)
  expect(dnDsRatio(feat({ ds: 0.4 }))).toBe(-1)
  expect(dnDsRatio(feat({}))).toBe(-1)
  expect(dnDsRatio(feat({ dn: 0.02, ds: 0 }))).toBe(-1)
  expect(dnDsRatio(feat({ dn: 0.02, ds: 'NULL' }))).toBe(-1)
})

// The point of the whole exercise: a measurement nobody anticipated is reachable
// without an enum member, a menu entry, a legend arm, a LUT, a typed array and
// an RPC transfer slot of its own.
test('an attribute mode resolves for a column no preset knows about', () => {
  const mode = resolveContinuousMode('attribute:goc_score', {
    goc_score: { min: 0, max: 100 },
  })
  expect(mode?.attribute).toBe('goc_score')
  expect(rampNorm(mode!, 50)).toBe(0.5)
  expect(rampNorm(mode!, 100)).toBe(1)
})

// A preset is a preset because it carries a domain a column name cannot supply,
// so naming one as an attribute must not quietly rescale it.
test('a preset keeps its declared domain, attributes take the observed one', () => {
  const preset = resolveContinuousMode('mappingQuality', {
    mappingQual: { min: 55, max: 60 },
  })
  expect(rampNorm(preset!, 30)).toBe(0.5)
  const observed = resolveContinuousMode('attribute:mappingQual', {
    mappingQual: { min: 55, max: 60 },
  })
  expect(rampNorm(observed!, 55)).toBe(0)
})

// The legend has to say what the ramp currently means, since an attribute scale
// is relative to what is in view.
test('an attribute ramp is labelled with its actual numbers', () => {
  const mode = resolveContinuousMode('attribute:dn', {
    dn: { min: 0, max: 0.0234567 },
  })
  expect([mode?.minLabel, mode?.maxLabel]).toEqual(['0', '0.0235'])
})

// One distinct value, or a column nothing carried: there is no gradient to
// place anything on, and dividing by the span would be a NaN across the view.
test('a flat or absent domain answers 0 rather than NaN', () => {
  const flat = resolveContinuousMode('attribute:x', { x: { min: 3, max: 3 } })
  expect(rampNorm(flat!, 3)).toBe(0)
  const absent = resolveContinuousMode('attribute:x')
  expect(rampNorm(absent!, 3)).toBe(0)
})

test('the structural modes are not continuous ones', () => {
  for (const mode of ['default', 'strand', 'query', 'target', 'track']) {
    expect(resolveContinuousMode(mode)).toBeUndefined()
  }
})
