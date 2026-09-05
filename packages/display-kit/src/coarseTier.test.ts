import {
  coarseTierCovers,
  resolveCoarseTier,
  resolveFetchSuspended,
} from './coarseTier.ts'
import { coarseTierModeOf, densityZoomBucket } from './densityTier.ts'

const base = {
  mode: 'auto' as const,
  hasSource: true,
  gateRefusesDetail: false,
  pastThreshold: false,
}

test('auto swaps on the gate verdict', () => {
  expect(resolveCoarseTier(base)).toBe(false)
  expect(resolveCoarseTier({ ...base, gateRefusesDetail: true })).toBe(true)
})

test('auto also swaps past the display threshold', () => {
  expect(resolveCoarseTier({ ...base, pastThreshold: true })).toBe(true)
})

test('the user overrides win in both directions', () => {
  expect(
    resolveCoarseTier({ ...base, mode: 'never', gateRefusesDetail: true }),
  ).toBe(false)
  expect(resolveCoarseTier({ ...base, mode: 'always' })).toBe(true)
})

test('no source means no tier, whatever the mode', () => {
  expect(
    resolveCoarseTier({ ...base, hasSource: false, gateRefusesDetail: true }),
  ).toBe(false)
  expect(resolveCoarseTier({ ...base, hasSource: false, mode: 'always' })).toBe(
    false,
  )
})

test('the density slot maps onto the policy', () => {
  expect(coarseTierModeOf('auto')).toBe('auto')
  expect(coarseTierModeOf('features')).toBe('never')
  expect(coarseTierModeOf('density')).toBe('always')
})

test('one bucket per doubling of bp/px, floored at 1 bp/px', () => {
  expect(densityZoomBucket(0.1)).toBe(0)
  expect(densityZoomBucket(1)).toBe(0)
  expect(densityZoomBucket(1000)).toBe(densityZoomBucket(1100))
  expect(densityZoomBucket(1000)).not.toBe(densityZoomBucket(2500))
})

test('the detail fetch stands down under the tier, except for the measurement a refused auto owes', () => {
  expect(
    resolveFetchSuspended({
      standsIn: true,
      mode: 'auto',
      gateRefusesDetail: false,
    }),
  ).toBe(true)
  expect(
    resolveFetchSuspended({
      standsIn: true,
      mode: 'auto',
      gateRefusesDetail: true,
    }),
  ).toBe(false)
  expect(
    resolveFetchSuspended({
      standsIn: true,
      mode: 'always',
      gateRefusesDetail: true,
    }),
  ).toBe(true)
  expect(
    resolveFetchSuspended({
      standsIn: false,
      mode: 'always',
      gateRefusesDetail: false,
    }),
  ).toBe(false)
})

test('held payloads cover the screen while every visible block sits inside its read', () => {
  const held = [
    {
      region: {
        refName: 'chr1',
        start: 1000,
        end: 5000,
        assemblyName: 'volvox',
      },
      displayedRegionIndex: 0,
    },
  ]
  const block = (start: number, end: number, displayedRegionIndex = 0) => ({
    refName: 'chr1',
    start,
    end,
    displayedRegionIndex,
  })
  expect(coarseTierCovers(held, [block(2000.4, 3000.6)])).toBe(true)
  expect(coarseTierCovers(held, [block(2000, 5001)])).toBe(false)
  expect(coarseTierCovers(held, [block(2000, 3000, 1)])).toBe(false)
  expect(coarseTierCovers(held, [])).toBe(true)
})
