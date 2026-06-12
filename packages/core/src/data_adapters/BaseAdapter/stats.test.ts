import { from } from 'rxjs'

import {
  calculateFeatureDensityStats,
  sampleFeaturesForInterval,
} from './stats.ts'
import SimpleFeature from '../../util/simpleFeature.ts'

import type { BaseOptions } from './types.ts'
import type { Feature } from '../../util/simpleFeature.ts'
import type { AugmentedRegion as Region } from '../../util/types/index.ts'
import type { Observable } from 'rxjs'

function region(start: number, end: number): Region {
  return { assemblyName: 'volvox', refName: 'ctgA', start, end }
}

// calculateFeatureDensityStats only reads the array length, so the feature
// contents are irrelevant — emit n trivial features.
function features(n: number): Observable<Feature> {
  return from(
    Array.from(
      { length: n },
      (_, i) => new SimpleFeature({ id: i, data: { start: i, end: i + 1 } }),
    ),
  )
}

// getFeatures stub returning a fixed count, recording each window it was
// queried with so tests can assert the sampling geometry / interval growth.
function fixedCount(n: number) {
  const calls: Region[] = []
  const getFeatures = (r: Region, _opts?: BaseOptions) => {
    calls.push(r)
    return features(n)
  }
  return { getFeatures, calls }
}

describe('sampleFeaturesForInterval', () => {
  test('samples an interval-wide window centered 25% into the region', async () => {
    const { getFeatures, calls } = fixedCount(5)
    const result = await sampleFeaturesForInterval(
      region(1000, 5000),
      1000,
      getFeatures,
    )
    expect(result).toHaveLength(5)
    // sampleCenter = 1000*0.75 + 5000*0.25 = 2000; window = center ± interval/2
    expect(calls).toEqual([region(1500, 2500)])
  })

  test('clamps the window to [0, region.end]', async () => {
    const { getFeatures, calls } = fixedCount(0)
    // region 0..1000, interval 4000: center=250, raw [-1750,2250] → clamped
    await sampleFeaturesForInterval(region(0, 1000), 4000, getFeatures)
    expect(calls[0]!.start).toBe(0)
    expect(calls[0]!.end).toBe(1000)
  })
})

describe('calculateFeatureDensityStats', () => {
  test('stops after one sample once min features (70) are hit, density = count/interval', async () => {
    const { getFeatures, calls } = fixedCount(70)
    const stats = await calculateFeatureDensityStats(
      region(0, 1_000_000),
      getFeatures,
    )
    // initial interval is 1000; 70 >= DENSITY_SAMPLE_MIN_FEATURES → exit round 1
    expect(calls).toHaveLength(1)
    expect(stats.featureDensity).toBeCloseTo(70 / 1000)
  })

  test('exits on the first sample when interval*2 exceeds the region length', async () => {
    // refLen 1500 < 2*initialInterval(1000) → size-based exit on round 1 even
    // though far fewer than 70 features were found
    const { getFeatures, calls } = fixedCount(3)
    const stats = await calculateFeatureDensityStats(region(0, 1500), getFeatures)
    expect(calls).toHaveLength(1)
    expect(stats.featureDensity).toBeCloseTo(3 / 1000)
  })

  test('reports zero density for an empty region', async () => {
    const { getFeatures } = fixedCount(0)
    const stats = await calculateFeatureDensityStats(region(0, 1500), getFeatures)
    expect(stats.featureDensity).toBe(0)
  })

  test('doubles the interval until the region is covered, dividing by the final interval', async () => {
    // refLen 100_000, always <70 features → samples 1000,2000,...,64000
    // (64000*2=128000 > 100000 ends it): 7 samples, density = count/64000.
    // Confirms the nominal interval — not the clamped window width — is the
    // divisor, even once the doubled window runs past coordinate 0.
    const { getFeatures, calls } = fixedCount(10)
    const stats = await calculateFeatureDensityStats(
      region(0, 100_000),
      getFeatures,
    )
    expect(calls).toHaveLength(7)
    expect(stats.featureDensity).toBeCloseTo(10 / 64000)
  })
})
