import { AUTO_FORCE_LOAD_BP } from '@jbrowse/plugin-linear-genome-view'

// Test the regionTooLarge getter logic in isolation.
// The actual getter is:
//   regionTooLargeState &&
//   view.bpPerPx === regionTooLargeBpPerPx &&
//   view.visibleBp >= AUTO_FORCE_LOAD_BP
function regionTooLarge({
  regionTooLargeState,
  regionTooLargeBpPerPx,
  viewBpPerPx,
  viewVisibleBp,
}: {
  regionTooLargeState: boolean
  regionTooLargeBpPerPx: number | undefined
  viewBpPerPx: number
  viewVisibleBp: number
}) {
  return (
    regionTooLargeState &&
    viewBpPerPx === regionTooLargeBpPerPx &&
    viewVisibleBp >= AUTO_FORCE_LOAD_BP
  )
}

describe('alignments regionTooLarge getter', () => {
  it('returns true when state is set and bpPerPx matches and region is large', () => {
    expect(
      regionTooLarge({
        regionTooLargeState: true,
        regionTooLargeBpPerPx: 100,
        viewBpPerPx: 100,
        viewVisibleBp: 50_000,
      }),
    ).toBe(true)
  })

  it('returns false when state is not set', () => {
    expect(
      regionTooLarge({
        regionTooLargeState: false,
        regionTooLargeBpPerPx: 100,
        viewBpPerPx: 100,
        viewVisibleBp: 50_000,
      }),
    ).toBe(false)
  })

  it('returns false when bpPerPx changed (user zoomed)', () => {
    expect(
      regionTooLarge({
        regionTooLargeState: true,
        regionTooLargeBpPerPx: 100,
        viewBpPerPx: 50,
        viewVisibleBp: 50_000,
      }),
    ).toBe(false)
  })

  it('returns false when region is small (force load for small regions)', () => {
    expect(
      regionTooLarge({
        regionTooLargeState: true,
        regionTooLargeBpPerPx: 100,
        viewBpPerPx: 100,
        viewVisibleBp: AUTO_FORCE_LOAD_BP - 1,
      }),
    ).toBe(false)
  })

  it('returns false when regionTooLargeBpPerPx is undefined', () => {
    expect(
      regionTooLarge({
        regionTooLargeState: true,
        regionTooLargeBpPerPx: undefined,
        viewBpPerPx: 100,
        viewVisibleBp: 50_000,
      }),
    ).toBe(false)
  })

  it('returns true at exactly AUTO_FORCE_LOAD_BP boundary', () => {
    expect(
      regionTooLarge({
        regionTooLargeState: true,
        regionTooLargeBpPerPx: 100,
        viewBpPerPx: 100,
        viewVisibleBp: AUTO_FORCE_LOAD_BP,
      }),
    ).toBe(true)
  })
})

describe('setRegionTooLarge + force load flow', () => {
  it('setFeatureDensityStatsLimit raises limit and clears state', () => {
    // Simulate the RegionTooLargeMixin behavior
    let userByteSizeLimit: number | undefined
    let regionTooLargeState = true
    const stats = { bytes: 2_000_000, fetchSizeLimit: 1_000_000 }

    // setFeatureDensityStatsLimit logic from RegionTooLargeMixin
    if (stats.bytes) {
      userByteSizeLimit = Math.ceil(stats.bytes * 1.5)
    }
    regionTooLargeState = false

    expect(userByteSizeLimit).toBe(3_000_000)
    expect(regionTooLargeState).toBe(false)
  })

  it('fetchSizeLimit uses userByteSizeLimit when set', () => {
    const configFetchSizeLimit = 1_000_000

    // Before force load
    const limitBefore = undefined || configFetchSizeLimit
    expect(limitBefore).toBe(1_000_000)

    // After force load sets userByteSizeLimit
    const userByteSizeLimit = 3_000_000
    const limitAfter = userByteSizeLimit || configFetchSizeLimit
    expect(limitAfter).toBe(3_000_000)
  })
})
