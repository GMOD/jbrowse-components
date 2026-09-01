import { from } from 'rxjs'

import SimpleFeature from '../../util/simpleFeature.ts'
import { calculateFeatureDensityStats } from './stats.ts'

import type { AugmentedRegion as Region } from '../../util/types/index.ts'

// A getFeatures stub that lays features every `spacingBp` across the whole
// reference and returns only those falling within the queried window, recording
// each window it was asked for so tests can assert what was sampled.
function makeGetFeatures(refEnd: number, spacingBp: number) {
  const all = Array.from({ length: Math.ceil(refEnd / spacingBp) }, (_, i) => {
    const start = i * spacingBp
    return new SimpleFeature({
      uniqueId: `f${i}`,
      refName: 'chr1',
      start,
      end: start + 1,
    })
  })
  const queries: { start: number; end: number }[] = []
  const getFeatures = (region: Region) => {
    queries.push({ start: region.start, end: region.end })
    return from(
      all.filter(
        f => f.get('start') >= region.start && f.get('start') < region.end,
      ),
    )
  }
  return { getFeatures, queries }
}

function region(start: number, end: number): Region {
  return { assemblyName: 'volvox', refName: 'chr1', start, end }
}

test('reports density per sampled bp for a dense region', async () => {
  // 1 feature/10bp; first 1000bp window sees 100 >= 70 features and returns.
  const { getFeatures, queries } = makeGetFeatures(1_000_000, 10)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
  )
  expect(featureDensity).toBeCloseTo(0.1)
  expect(queries).toHaveLength(1)
})

test('divides by the bp actually sampled when the window covers the whole region', async () => {
  // Region (500bp) is smaller than the initial 1000bp interval, so the window
  // clamps to the region and density must divide by 500, not the nominal 1000.
  const { getFeatures } = makeGetFeatures(1_000_000, 10)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 500),
    getFeatures,
  )
  // 50 features over 500bp = 0.1/bp; dividing by the nominal 1000 would halve it
  expect(featureDensity).toBeCloseTo(0.1)
})

test('never samples outside the region (left edge clamps to region start)', async () => {
  const { getFeatures, queries } = makeGetFeatures(2_000_000, 10)
  await calculateFeatureDensityStats(region(1_000_000, 1_000_500), getFeatures)
  for (const q of queries) {
    expect(q.start).toBeGreaterThanOrEqual(1_000_000)
    expect(q.end).toBeLessThanOrEqual(1_000_500)
  }
})

test('grows the window for a sparse region before reporting density', async () => {
  // 1 feature/2000bp: the initial 1000bp window sees ~0-1 features, so sampling
  // doubles the interval until it either hits 70 features or covers the region.
  const { getFeatures, queries } = makeGetFeatures(1_000_000, 2000)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
  )
  expect(featureDensity).toBeCloseTo(1 / 2000)
  expect(queries.length).toBeGreaterThan(1)
})

test('counts only admitted features when an admit predicate is given', async () => {
  // 1 feature/10bp, but admission keeps every 4th — the reported density must
  // describe the population the caller will actually draw (0.025/bp), not the
  // raw one (0.1/bp), so a gate downstream can't reject a filtered view on
  // features it filters away.
  const { getFeatures } = makeGetFeatures(1_000_000, 10)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
    undefined,
    f => f.get('start') % 40 === 0,
  )
  expect(featureDensity).toBeCloseTo(0.025)
})

test('grows the window on the raw count, not the admitted count', async () => {
  // 1 feature/10bp with an admit predicate that keeps almost nothing. The raw
  // count clears 70 in the first 1000bp window, so sampling must stop there.
  // Growing on the admitted count instead would double the window until it
  // spanned the region — a second full download for exactly the filtered views
  // this probe is supposed to make cheap.
  const { getFeatures, queries } = makeGetFeatures(1_000_000, 10)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
    undefined,
    f => f.get('start') === 0,
  )
  expect(queries).toHaveLength(1)
  expect(featureDensity).toBeCloseTo(1 / 1000)
})

// A gate shaped like the canvas one: settle at `perBp` with at least
// `minFeatures` admitted, and start at the window that many features would fill.
function gateAt(perBp: number, minFeatures = 8) {
  return {
    initialInterval: minFeatures / perBp,
    settled: (admitted: number, sampledBp: number) =>
      admitted >= minFeatures && admitted / sampledBp >= perBp,
  }
}

test('starts at the window the gate asks for rather than the fixed floor', async () => {
  // Sparse enough that the 1000bp floor would ladder ~10 times to reach 70
  // features. The gate's window settles it in one.
  const { getFeatures, queries } = makeGetFeatures(10_000_000, 5000)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 10_000_000),
    getFeatures,
    undefined,
    undefined,
    gateAt(1 / 10_000),
  )
  expect(queries).toHaveLength(1)
  expect(queries[0]!.end - queries[0]!.start).toBe(80_000)
  expect(featureDensity).toBeCloseTo(1 / 5000)
})

test('never starts below the fixed floor, so a narrow gate window is the old behavior', async () => {
  // At low bpPerPx the gate's window is sub-kilobase; the probe must not sample
  // narrower than it always has.
  const { getFeatures, queries } = makeGetFeatures(1_000_000, 10)
  await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
    undefined,
    undefined,
    gateAt(1 / 10),
  )
  expect(queries[0]!.end - queries[0]!.start).toBe(1000)
})

test('keeps laddering when the sample does not clear the settling margin', async () => {
  // 1 feature/2000bp against a gate that settles at 1/500bp: four times short,
  // so the verdict is not decided and the probe grows exactly as before.
  const { getFeatures, queries } = makeGetFeatures(1_000_000, 2000)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
    undefined,
    undefined,
    gateAt(1 / 500),
  )
  expect(queries.length).toBeGreaterThan(1)
  expect(featureDensity).toBeCloseTo(1 / 2000)
})

test('settles on the admitted count, so a filtered view is not refused early', async () => {
  // 1 feature/100bp with admission keeping one in eight. The gate's own window
  // holds 16 raw features and 2 admitted, against a threshold of 8: settling on
  // the raw count would decide the verdict there and refuse a view whose drawn
  // population is an eighth of what it measured. The raw count stays under 70,
  // so that exit can't stand in for the gate's and hide the difference — a probe
  // settling on the wrong count returns after one window instead of laddering.
  const { getFeatures, queries } = makeGetFeatures(1_000_000, 100)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 1_000_000),
    getFeatures,
    undefined,
    f => f.get('start') % 800 === 0,
    gateAt(1 / 200),
  )
  expect(queries.length).toBeGreaterThan(1)
  expect(featureDensity).toBeCloseTo(1 / 800)
})

test('a gate that never settles leaves the timeout path unchanged', async () => {
  // An empty reference: no window ever admits anything, so neither the gate nor
  // the 70-feature exit fires and the region-spanning exit still ends it.
  const { getFeatures } = makeGetFeatures(0, 10)
  const { featureDensity } = await calculateFeatureDensityStats(
    region(0, 100_000),
    getFeatures,
    undefined,
    undefined,
    gateAt(1 / 1000),
  )
  expect(featureDensity).toBe(0)
})
