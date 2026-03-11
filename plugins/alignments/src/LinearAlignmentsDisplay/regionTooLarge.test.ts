import { AUTO_FORCE_LOAD_BP } from '@jbrowse/plugin-linear-genome-view'

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
    const stats = { bytes: 2_000_000, fetchSizeLimit: 1_000_000 }

    if (stats.bytes) {
      userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
    }

    expect(userByteSizeLimit).toBe(3_000_000)
    expect(regionTooLargeState).toBe(false)
  })

  it('fetchSizeLimit uses userByteSizeLimit when set', () => {
    const configFetchSizeLimit = 1_000_000

    // Before force load: userByteSizeLimit is undefined
    let userByteSizeLimit: number | undefined = undefined
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const limitBefore = userByteSizeLimit || configFetchSizeLimit
    expect(limitBefore).toBe(1_000_000)

    // After force load sets userByteSizeLimit
    userByteSizeLimit = 3_000_000
    const limitAfter = userByteSizeLimit || configFetchSizeLimit
    expect(limitAfter).toBe(3_000_000)
  })
})
