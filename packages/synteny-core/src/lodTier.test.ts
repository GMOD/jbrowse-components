import { resolveLodTier } from './lodTier.ts'

const auto = (bpPerPx: number, coarseBpPerPxThreshold: number | undefined) =>
  resolveLodTier({ bpPerPx, coarseBpPerPxThreshold, lodMode: 'auto' })

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
      }),
    ).toBe('fine')
    expect(
      resolveLodTier({
        bpPerPx: 1,
        coarseBpPerPxThreshold: 10000,
        lodMode: 'coarse',
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
})
