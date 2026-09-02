import {
  coarseWalkIsApproximate,
  effectiveCoarseThreshold,
  readLodTierInfo,
  resolveLodTier,
} from './lodTier.ts'

import type { LodTierInfo } from './lodTier.ts'

const auto = (
  bpPerPx: number,
  coarseBpPerPxThreshold: number | undefined,
  tierInfo?: LodTierInfo,
) =>
  resolveLodTier({ bpPerPx, coarseBpPerPxThreshold, lodMode: 'auto', tierInfo })

const twoTier: LodTierInfo = { hasCoarseTier: true, coarseGap: 10000 }
const singleTier: LodTierInfo = { hasCoarseTier: false }

describe('resolveLodTier', () => {
  test('auto goes coarse once zoomed out past the threshold', () => {
    expect(auto(20000, 10000)).toBe('coarse')
  })

  test('auto stays fine while zoomed in', () => {
    expect(auto(10, 10000)).toBe('fine')
  })

  test('auto is coarse exactly at the threshold', () => {
    expect(auto(10000, 10000)).toBe('coarse')
  })

  // An adapter with no tiering has no threshold slot, and only the fine tier to
  // serve, so no zoom can move it
  test('auto stays fine at any zoom with no threshold', () => {
    expect(auto(1e9, undefined)).toBe('fine')
  })

  test('a pinned tier ignores the zoom', () => {
    expect(
      resolveLodTier({
        bpPerPx: 1e9,
        coarseBpPerPxThreshold: 10000,
        lodMode: 'fine',
        tierInfo: twoTier,
      }),
    ).toBe('fine')
    expect(
      resolveLodTier({
        bpPerPx: 1,
        coarseBpPerPxThreshold: 10000,
        lodMode: 'coarse',
        tierInfo: twoTier,
      }),
    ).toBe('coarse')
  })

  // The bug this function exists to make impossible. LinearSyntenyDisplay keys
  // its refetch on floor(log2(bpPerPx)), and the default 10000 threshold sits
  // inside bucket 13 (8192..16384) — so two zooms that share a bucket can want
  // different tiers. Resolving adapter-side hid that from the cache key and left
  // the view drawing coarse ribbons below the threshold; the tier has to be a
  // value the key can see change.
  test('the tier flips within one log2 zoom bucket', () => {
    const bucket = (bpPerPx: number) => Math.floor(Math.log2(bpPerPx))
    expect(bucket(12000)).toBe(bucket(9000))
    expect(auto(12000, 10000)).toBe('coarse')
    expect(auto(9000, 10000)).toBe('fine')
  })

  // The info arrives asynchronously, after the first fetch may already be
  // keyed. For a file built with the defaults the two answers have to agree at
  // every zoom, or the info landing refetches what was just fetched.
  test('a default-built file resolves the same before and after its info lands', () => {
    for (const bpPerPx of [1, 9999, 10000, 12000, 1e6]) {
      expect(auto(bpPerPx, 10000, twoTier)).toBe(auto(bpPerPx, 10000))
    }
  })

  // The `--no-coarse` file: the adapter serves fine whatever is asked, so the
  // key has to say fine too, or every threshold crossing refetches the same
  // bytes. Pinned coarse included, since that is what the adapter hands back.
  test('a file with no coarse tier is fine at any zoom under any mode', () => {
    expect(auto(1e9, 10000, singleTier)).toBe('fine')
    expect(
      resolveLodTier({
        bpPerPx: 1e9,
        coarseBpPerPxThreshold: 10000,
        lodMode: 'coarse',
        tierInfo: singleTier,
      }),
    ).toBe('fine')
  })

  // A slot below the file's bound would serve the fold where its runs lean by
  // more than a pixel, so the bound wins; a slot above it is a legitimate
  // preference for more detail and stands.
  test('the threshold is clamped up to the header bound, never down', () => {
    const wideFold: LodTierInfo = { hasCoarseTier: true, coarseGap: 50000 }
    expect(auto(20000, 10000, wideFold)).toBe('fine')
    expect(auto(50000, 10000, wideFold)).toBe('coarse')
    expect(auto(20000, 40000, twoTier)).toBe('fine')
    expect(auto(40000, 40000, twoTier)).toBe('coarse')
  })

  // A file from before the header states no bound; the slot is all there is
  test('a headerless two-tier file trusts the slot', () => {
    const headerless: LodTierInfo = { hasCoarseTier: true }
    expect(auto(9999, 10000, headerless)).toBe('fine')
    expect(auto(10000, 10000, headerless)).toBe('coarse')
  })
})

describe('effectiveCoarseThreshold', () => {
  test('is undefined with no slot, and for a single-tier file', () => {
    expect(
      effectiveCoarseThreshold({
        coarseBpPerPxThreshold: undefined,
        tierInfo: twoTier,
      }),
    ).toBeUndefined()
    expect(
      effectiveCoarseThreshold({
        coarseBpPerPxThreshold: 10000,
        tierInfo: singleTier,
      }),
    ).toBeUndefined()
  })

  test('is the slot until the info lands, then the max of slot and bound', () => {
    expect(
      effectiveCoarseThreshold({
        coarseBpPerPxThreshold: 5000,
        tierInfo: undefined,
      }),
    ).toBe(5000)
    expect(
      effectiveCoarseThreshold({
        coarseBpPerPxThreshold: 5000,
        tierInfo: twoTier,
      }),
    ).toBe(10000)
    expect(
      effectiveCoarseThreshold({
        coarseBpPerPxThreshold: 20000,
        tierInfo: twoTier,
      }),
    ).toBe(20000)
  })
})

describe('coarseWalkIsApproximate', () => {
  const approximate = (
    bpPerPx: number,
    lodTier: 'fine' | 'coarse',
    tierInfo?: LodTierInfo,
  ) =>
    coarseWalkIsApproximate({
      bpPerPx,
      lodTier,
      coarseBpPerPxThreshold: 10000,
      tierInfo,
    })

  test('only a coarse walk below the bound is approximate', () => {
    expect(approximate(1000, 'coarse', twoTier)).toBe(true)
    expect(approximate(10000, 'coarse', twoTier)).toBe(false)
    expect(approximate(1000, 'fine', twoTier)).toBe(false)
  })

  // The bound is the file's, not the slot's: a slot raised above the bound is
  // a preference for detail, not a wider fold
  test('a slot above the bound does not widen what counts as approximate', () => {
    expect(
      coarseWalkIsApproximate({
        bpPerPx: 15000,
        lodTier: 'coarse',
        coarseBpPerPxThreshold: 20000,
        tierInfo: twoTier,
      }),
    ).toBe(false)
  })

  test('the slot stands in for the bound until the info lands', () => {
    expect(approximate(9999, 'coarse')).toBe(true)
    expect(approximate(10000, 'coarse')).toBe(false)
  })
})

describe('readLodTierInfo', () => {
  test('reads the PIF adapters getHeader shape', () => {
    expect(
      readLodTierInfo({
        version: 1,
        tiers: ['fine', 'coarse'],
        coarseGap: 1000,
        cigars: 'all',
        hasCoarseTier: true,
      }),
    ).toEqual({ hasCoarseTier: true, coarseGap: 1000 })
    expect(readLodTierInfo({ hasCoarseTier: false })).toEqual({
      hasCoarseTier: false,
      coarseGap: undefined,
    })
  })

  test('anything else is unknown', () => {
    expect(readLodTierInfo(null)).toBeUndefined()
    expect(readLodTierInfo('##fileformat=VCFv4.2')).toBeUndefined()
    expect(readLodTierInfo({ coarseGap: 1000 })).toBeUndefined()
  })
})
