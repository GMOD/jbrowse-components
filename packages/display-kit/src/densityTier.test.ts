import {
  densityZoomBucket,
  resolveDensityTier,
  resolveFetchSuspended,
} from './densityTier.ts'

const base = {
  mode: 'auto' as const,
  hasSource: true,
  regionTooLarge: false,
  bpPerPx: 100,
  thresholdBpPerPx: 0,
}

test('auto swaps on the gate verdict', () => {
  expect(resolveDensityTier(base)).toBe(false)
  expect(resolveDensityTier({ ...base, regionTooLarge: true })).toBe(true)
})

test('auto also swaps past an explicit bp/px threshold', () => {
  expect(resolveDensityTier({ ...base, thresholdBpPerPx: 50 })).toBe(true)
  expect(resolveDensityTier({ ...base, thresholdBpPerPx: 500 })).toBe(false)
  expect(
    resolveDensityTier({ ...base, thresholdBpPerPx: 50, bpPerPx: undefined }),
  ).toBe(false)
})

test('the user overrides win in both directions', () => {
  expect(
    resolveDensityTier({ ...base, mode: 'features', regionTooLarge: true }),
  ).toBe(false)
  expect(resolveDensityTier({ ...base, mode: 'density' })).toBe(true)
})

test('no source means no tier, whatever the mode', () => {
  expect(
    resolveDensityTier({ ...base, hasSource: false, regionTooLarge: true }),
  ).toBe(false)
  expect(
    resolveDensityTier({ ...base, hasSource: false, mode: 'density' }),
  ).toBe(false)
})

test('one bucket per doubling of bp/px, floored at 1 bp/px', () => {
  expect(densityZoomBucket(0.1)).toBe(0)
  expect(densityZoomBucket(1)).toBe(0)
  expect(densityZoomBucket(1000)).toBe(densityZoomBucket(1100))
  expect(densityZoomBucket(1000)).not.toBe(densityZoomBucket(2500))
})

test('the fetch stands down under the band, except for the measurement a refused auto owes', () => {
  expect(
    resolveFetchSuspended({
      standsIn: true,
      mode: 'auto',
      regionTooLarge: false,
    }),
  ).toBe(true)
  expect(
    resolveFetchSuspended({
      standsIn: true,
      mode: 'auto',
      regionTooLarge: true,
    }),
  ).toBe(false)
  expect(
    resolveFetchSuspended({
      standsIn: true,
      mode: 'density',
      regionTooLarge: true,
    }),
  ).toBe(true)
  expect(
    resolveFetchSuspended({
      standsIn: false,
      mode: 'density',
      regionTooLarge: false,
    }),
  ).toBe(false)
})
