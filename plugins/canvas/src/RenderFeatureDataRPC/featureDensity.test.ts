import { SimpleFeature } from '@jbrowse/core/util'
import { of } from 'rxjs'

import {
  DENSITY_SETTLE_FEATURES,
  DENSITY_SETTLE_MARGIN,
  densityProbeGate,
  densityTooLargeResult,
  featuresPerPx,
  overDensityBudget,
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

  // unguarded this is `count / 0` -> Infinity: a refusal to fetch nothing
  it('is zero, not Infinity, for a region with no span', () => {
    expect(featuresPerPx(5000, { start: 100, end: 100 }, 10)).toBe(0)
    expect(featuresPerPx(0, { start: 100, end: 100 }, 10)).toBe(0)
    expect(featuresPerPx(5000, { start: 200, end: 100 }, 10)).toBe(0)
  })
})

// The comparison the whole axis is made of, in one place because its three
// callers — the pre-fetch sample, the post-fetch exact count, and the
// main-thread banner — must not answer differently at the boundary. The byte
// axis pins the same rule on `overByteBudget`; this one went unpinned until a
// mutation sweep swapped the `>` for `>=` and every gate test stayed green.
describe('overDensityBudget', () => {
  it('is over only when strictly above the budget', () => {
    expect(overDensityBudget(1.0001, 1)).toBe(true)
    expect(overDensityBudget(1, 1)).toBe(false)
    expect(overDensityBudget(0.9999, 1)).toBe(false)
  })

  it('reads an undefined budget as the axis not gating, not as zero', () => {
    expect(overDensityBudget(1_000_000, undefined)).toBe(false)
    expect(overDensityBudget(0, undefined)).toBe(false)
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
    expect(
      densityTooLargeResult(0.001, region, 1, 1, undefined),
    ).toBeUndefined()
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
      densityTooLargeResult(
        Number.POSITIVE_INFINITY,
        region,
        1000,
        1,
        undefined,
      ),
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
      admit: () => true,
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
      admit: () => true,
    })
    expect(result).toBeUndefined()
  })

  it('gates on the admitted population, not the raw one', async () => {
    // The same 100-feature sample at the same zoom, decided two ways. Admitting
    // everything: 0.1/bp over 1Mb = 100k features / 10k px = 10/px, rejected.
    // Admitting 5 of the 100: 5k features / 10k px = 0.5/px, allowed. Only the
    // predicate differs, so this pins the gate to the population that will
    // actually be drawn rather than the raw one it was measured from.
    const args = {
      dataAdapter: fakeAdapter(100),
      region,
      bpPerPx: 100,
      maxFeatureDensity: 1,
      bytes: undefined,
    }
    expect(
      (await samplePreFetchDensity({ ...args, admit: () => true }))
        ?.regionTooLarge,
    ).toBe(true)
    expect(
      await samplePreFetchDensity({
        ...args,
        admit: f => f.get('start') < 5,
      }),
    ).toBeUndefined()
  })

  it('still runs under the NCBI gbkey=Src source-record gate', async () => {
    // Regression guard for a gate that was inert in production: this stage used
    // to be skipped whenever any admission filter was active, and the source
    // record rule shipped as the `jexlFilters` slot's default, so every
    // default-configured track skipped it and no track ever sampled. The rule
    // drops at most one feature per molecule, so a dense region must still be
    // rejected pre-fetch under it.
    const result = await samplePreFetchDensity({
      dataAdapter: fakeAdapter(100),
      region,
      bpPerPx: 1000,
      maxFeatureDensity: 1,
      bytes: undefined,
      admit: f => f.get('gbkey') !== 'Src',
    })
    expect(result?.regionTooLarge).toBe(true)
  })
})

// The probe's stopping rule, which decides both what the first sample window
// costs and when the ladder stops. Its whole content is that a window is asked
// for in *pixels* rather than bp, so the same rule holds at every zoom.
describe('densityProbeGate', () => {
  it('asks for a window of DENSITY_SETTLE_FEATURES / DENSITY_SETTLE_MARGIN pixels', () => {
    const px = DENSITY_SETTLE_FEATURES / DENSITY_SETTLE_MARGIN
    for (const bpPerPx of [1000, 100_000, 3_088_000]) {
      const { initialInterval } = densityProbeGate(bpPerPx, 1)
      expect(initialInterval / bpPerPx).toBeCloseTo(px)
    }
  })

  it('settles exactly at the margin, on the count and the density together', () => {
    // whole-genome-ish: 3.088e6 bp/px against a budget of 1/px
    const { initialInterval, settled } = densityProbeGate(3_088_000, 1)
    // the window is sized so DENSITY_SETTLE_FEATURES in it is exactly the margin
    expect(settled(DENSITY_SETTLE_FEATURES, initialInterval)).toBe(true)
    expect(settled(DENSITY_SETTLE_FEATURES - 1, initialInterval)).toBe(false)
    // and a count that clears the threshold in too wide a window does not
    expect(settled(DENSITY_SETTLE_FEATURES, initialInterval * 2)).toBe(false)
  })

  // A looser budget is reached by fewer bp, so the window that can settle it is
  // narrower — the window tracks the question, not the zoom alone.
  it('narrows the window as the budget loosens', () => {
    expect(densityProbeGate(100_000, 10).initialInterval).toBeCloseTo(
      densityProbeGate(100_000, 1).initialInterval / 10,
    )
  })

  // A whole-chromosome view of an annotation track sits a few times over budget,
  // not a hundred, and that verdict has to be measured rather than extrapolated:
  // the settling exit must not fire there, leaving the 70-feature ladder to it.
  it('does not settle on a near-threshold density', () => {
    const bpPerPx = 133_797
    const { settled } = densityProbeGate(bpPerPx, 1)
    // 3.2 features/px — genuinely over budget, but only 3.2x
    const sampledBp = 1_000_000
    const admitted = Math.round((3.2 * sampledBp) / bpPerPx)
    expect(admitted).toBeGreaterThan(DENSITY_SETTLE_FEATURES)
    expect(settled(admitted, sampledBp)).toBe(false)
  })
})
