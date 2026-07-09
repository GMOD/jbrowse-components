import { from } from 'rxjs'

import { calculateFeatureDensityStats } from './stats.ts'
import SimpleFeature from '../../util/simpleFeature.ts'

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
