import { SimpleFeature } from '@jbrowse/core/util'
import { of } from 'rxjs'

import {
  densityTooLargeResult,
  featuresPerPx,
  samplePreFetchDensity,
} from './densityGate.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// Density gate used in executeRenderFeatureData: features-per-pixel over a
// region vs maxFeatureScreenDensity, measured identically pre- and post-fetch.

describe('featuresPerPx', () => {
  it('sparse features stay below the limit', () => {
    // 100 features / (10000bp / 10bpPerPx = 1000px) = 0.1 features/px
    expect(featuresPerPx(100, { start: 0, end: 10_000 }, 10)).toBeCloseTo(0.1)
  })

  it('dense features exceed the limit', () => {
    // 50000 / 1000px = 50 features/px
    expect(featuresPerPx(50_000, { start: 0, end: 10_000 }, 10)).toBe(50)
  })

  it('same count is denser when zoomed in (fewer px)', () => {
    const region = { start: 0, end: 10_000 }
    expect(featuresPerPx(5000, region, 100)).toBeGreaterThan(
      featuresPerPx(5000, region, 10),
    )
  })
})

describe('densityTooLargeResult', () => {
  const region = { start: 0, end: 1_000_000 }

  it('blocks when the extrapolated density exceeds the limit', () => {
    // 0.1/bp over 1Mb = 100k features; at 1000bpPerPx = 1000px -> 100/px > 1
    const result = densityTooLargeResult(0.1, region, 1000, 1, 12345)
    expect(result).toEqual({
      regionTooLarge: true,
      featureCount: 100_000,
      bytes: 12345,
    })
  })

  it('emits a finite featureCount (never Infinity/undefined) when blocking', () => {
    // Regression guard: a too-large result missing a finite featureCount is read
    // by the model as a byte short-circuit, so the density banner never latches
    // and the fetch autorun re-fires forever.
    const result = densityTooLargeResult(0.1, region, 1000, 1, undefined)
    expect(result?.regionTooLarge).toBe(true)
    expect(Number.isFinite(result?.featureCount)).toBe(true)
  })

  it('allows a region below the limit (returns undefined)', () => {
    // 0.001/bp over 1Mb = 1000 features; at 1bpPerPx = 1Mpx -> 0.001/px < 1
    expect(densityTooLargeResult(0.001, region, 1, 1, undefined)).toBeUndefined()
  })

  it('does not block exactly at the boundary (strictly greater)', () => {
    // 1/bp over 1Mb at 1bpPerPx: 1e6 features / 1e6 px = 1/px, equals limit
    expect(densityTooLargeResult(1, region, 1, 1, undefined)).toBeUndefined()
  })

  it('decides on the rounded count (no round-across-threshold loop)', () => {
    // Unrounded density 1000.4/1000px = 1.0004 > 1 would block, but the count
    // rounds to 1000 -> density 1.0 (not > 1), which is exactly what the model
    // re-derives from the returned featureCount. Deciding on the same rounded
    // count keeps the two in agreement, so we never bail without the model also
    // latching the banner (which would re-trigger the fetch).
    expect(
      densityTooLargeResult(1.0004, { start: 0, end: 1000 }, 1, 1, undefined),
    ).toBeUndefined()
  })

  it('falls through on a non-finite density (sampling timeout)', () => {
    // Infinity means "could not estimate": defer to the full fetch rather than
    // emitting Infinity, which JSON would serialize to null and slip the gate.
    expect(
      densityTooLargeResult(Number.POSITIVE_INFINITY, region, 1000, 1, undefined),
    ).toBeUndefined()
  })
})

describe('samplePreFetchDensity', () => {
  // Minimal test double: only getFeatures is exercised by the sampler. It
  // returns the same features for any sampled window, so the estimate is
  // deterministic (>= 70 features means the sampler stops after one window).
  function fakeAdapter(featuresPerWindow: number) {
    const feats = Array.from(
      { length: featuresPerWindow },
      (_, i) =>
        new SimpleFeature({
          uniqueId: `f${i}`,
          refName: 'chr1',
          start: i,
          end: i + 1,
        }),
    )
    return {
      getFeatures: () => of(...feats),
    } as unknown as BaseFeatureDataAdapter
  }

  const region = {
    refName: 'chr1',
    start: 0,
    end: 1_000_000,
    assemblyName: 'volvox',
  }

  it('rejects a dense region with a finite estimated featureCount', async () => {
    // 100 features in the 1000bp sample = 0.1/bp; at 1000bpPerPx = 100/px > 1
    const result = await samplePreFetchDensity({
      dataAdapter: fakeAdapter(100),
      region,
      bpPerPx: 1000,
      maxFeatureDensity: 1,
      bytes: undefined,
    })
    expect(result?.regionTooLarge).toBe(true)
    expect(Number.isFinite(result?.featureCount)).toBe(true)
  })

  it('passes a sparse-enough region through to the full fetch', async () => {
    // Same 0.1/bp estimate, but at 1bpPerPx = 0.1/px < 1
    const result = await samplePreFetchDensity({
      dataAdapter: fakeAdapter(100),
      region,
      bpPerPx: 1,
      maxFeatureDensity: 1,
      bytes: undefined,
    })
    expect(result).toBeUndefined()
  })
})
