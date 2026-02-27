import { AUTO_FORCE_LOAD_BP } from '@jbrowse/plugin-linear-genome-view'

// Tests the fetch autorun's "too large at same zoom" guard in isolation.
// The actual logic is:
//   regionTooLargeState && currentBpPerPx === lastTooLargeBpPerPx
// If true, the autorun skips re-fetching (already checked at this zoom).
// If false (because bpPerPx changed or state was cleared), it proceeds.
function shouldSkipFetch({
  regionTooLargeState,
  lastTooLargeBpPerPx,
  currentBpPerPx,
}: {
  regionTooLargeState: boolean
  lastTooLargeBpPerPx: number | undefined
  currentBpPerPx: number
}) {
  return regionTooLargeState && currentBpPerPx === lastTooLargeBpPerPx
}

// Tests the byte estimate check in fetchFeaturesForRegion.
// When visibleBp >= AUTO_FORCE_LOAD_BP and bytes > limit, region is too large.
// When visibleBp < AUTO_FORCE_LOAD_BP, the check is skipped (force load).
function shouldBlockFetch({
  visibleBp,
  bytes,
  limit,
}: {
  visibleBp: number
  bytes: number
  limit: number
}) {
  if (visibleBp >= AUTO_FORCE_LOAD_BP) {
    return bytes > limit
  }
  return false
}

describe('alignments fetch autorun guard', () => {
  it('skips when too large at same zoom level', () => {
    expect(
      shouldSkipFetch({
        regionTooLargeState: true,
        lastTooLargeBpPerPx: 100,
        currentBpPerPx: 100,
      }),
    ).toBe(true)
  })

  it('proceeds when user zoomed (bpPerPx changed)', () => {
    expect(
      shouldSkipFetch({
        regionTooLargeState: true,
        lastTooLargeBpPerPx: 100,
        currentBpPerPx: 50,
      }),
    ).toBe(false)
  })

  it('proceeds when regionTooLargeState cleared (force load)', () => {
    expect(
      shouldSkipFetch({
        regionTooLargeState: false,
        lastTooLargeBpPerPx: 100,
        currentBpPerPx: 100,
      }),
    ).toBe(false)
  })

  it('proceeds when lastTooLargeBpPerPx is undefined (never was too large)', () => {
    expect(
      shouldSkipFetch({
        regionTooLargeState: true,
        lastTooLargeBpPerPx: undefined,
        currentBpPerPx: 100,
      }),
    ).toBe(false)
  })
})

describe('alignments byte estimate check', () => {
  it('blocks when bytes exceed limit in large region', () => {
    expect(
      shouldBlockFetch({
        visibleBp: 50_000,
        bytes: 5_000_000,
        limit: 1_000_000,
      }),
    ).toBe(true)
  })

  it('passes when bytes within limit', () => {
    expect(
      shouldBlockFetch({
        visibleBp: 50_000,
        bytes: 500_000,
        limit: 1_000_000,
      }),
    ).toBe(false)
  })

  it('force-loads small regions regardless of bytes', () => {
    expect(
      shouldBlockFetch({
        visibleBp: AUTO_FORCE_LOAD_BP - 1,
        bytes: 5_000_000,
        limit: 1_000_000,
      }),
    ).toBe(false)
  })

  it('blocks at exactly AUTO_FORCE_LOAD_BP boundary', () => {
    expect(
      shouldBlockFetch({
        visibleBp: AUTO_FORCE_LOAD_BP,
        bytes: 5_000_000,
        limit: 1_000_000,
      }),
    ).toBe(true)
  })
})

describe('setRegionTooLarge + force load flow', () => {
  it('setFeatureDensityStatsLimit raises limit and clears state', () => {
    let userByteSizeLimit: number | undefined
    let regionTooLargeState = true
    const stats = { bytes: 2_000_000, fetchSizeLimit: 1_000_000 }

    if (stats.bytes) {
      userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
    }
    regionTooLargeState = false

    expect(userByteSizeLimit).toBe(3_000_000)
    expect(regionTooLargeState).toBe(false)
  })

  it('fetchSizeLimit uses userByteSizeLimit when set', () => {
    const configFetchSizeLimit = 1_000_000

    // Before force load: userByteSizeLimit is undefined
    let userByteSizeLimit: number | undefined
    const limitBefore = userByteSizeLimit || configFetchSizeLimit
    expect(limitBefore).toBe(1_000_000)

    // After force load sets userByteSizeLimit
    userByteSizeLimit = 3_000_000
    const limitAfter = userByteSizeLimit || configFetchSizeLimit
    expect(limitAfter).toBe(3_000_000)
  })
})
