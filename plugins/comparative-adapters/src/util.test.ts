import { pafIdentity, resolveCoarseTier } from './util.ts'

describe('pafIdentity', () => {
  test('prefers de:f: tag (1 - de)', () => {
    expect(
      pafIdentity({ de: 0.02, numMatches: 50, blockLen: 100 }),
    ).toBeCloseTo(0.98)
  })

  test('falls back to id:f: (fraction)', () => {
    expect(pafIdentity({ id: 0.95, numMatches: 50, blockLen: 100 })).toBe(0.95)
  })

  test('falls back to id:f: as percentage', () => {
    expect(pafIdentity({ id: 95, numMatches: 50, blockLen: 100 })).toBe(0.95)
  })

  test('falls back to numMatches/blockLen', () => {
    expect(pafIdentity({ numMatches: 95, blockLen: 100 })).toBe(0.95)
  })

  test('returns 0 when blockLen is missing', () => {
    expect(pafIdentity({})).toBe(0)
  })

  test('ignores invalid de values', () => {
    expect(pafIdentity({ de: 2, numMatches: 90, blockLen: 100 })).toBe(0.9)
  })
})

// The tier chooser for the all-vs-all indexed adapter (PairwiseIndexedPAFAdapter
// has its own twin, pickPifPrefix, tested alongside it). `lodMode` exists
// because the alignments fetch path an LGV synteny track goes through supplies
// no bpPerPx, so the 'auto' heuristic below can only ever answer "fine" there —
// the display resolves the tier itself and states it outright.
describe('resolveCoarseTier', () => {
  const auto = (bpPerPx: number | undefined, hasCoarseTier = true) =>
    resolveCoarseTier({ bpPerPx, threshold: 10000, hasCoarseTier })

  test('auto goes coarse once zoomed out past the threshold', () => {
    expect(auto(20000)).toBe(true)
  })

  test('auto stays fine while zoomed in', () => {
    expect(auto(10)).toBe(false)
  })

  // the boundary the display's own resolver mirrors
  test('auto is coarse exactly at the threshold', () => {
    expect(auto(10000)).toBe(true)
  })

  // precisely the case the display-side lodMode was added for: no bpPerPx means
  // auto can never reach the coarse tier, however far out the view is
  test('auto cannot reach coarse without a bpPerPx', () => {
    expect(auto(undefined)).toBe(false)
  })

  test('an explicit fine overrides auto at extreme zoom-out', () => {
    expect(
      resolveCoarseTier({
        bpPerPx: 1e9,
        threshold: 10000,
        hasCoarseTier: true,
        lodMode: 'fine',
      }),
    ).toBe(false)
  })

  test('an explicit coarse overrides auto while zoomed in', () => {
    expect(
      resolveCoarseTier({
        bpPerPx: 1,
        threshold: 10000,
        hasCoarseTier: true,
        lodMode: 'coarse',
      }),
    ).toBe(true)
  })

  // a file made without a coarse tier has no T/Q rows to read, so asking for
  // one must degrade rather than query prefixes that return nothing
  test('coarse degrades to fine when the file has no coarse tier', () => {
    expect(
      resolveCoarseTier({
        bpPerPx: 1e9,
        threshold: 10000,
        hasCoarseTier: false,
        lodMode: 'coarse',
      }),
    ).toBe(false)
  })
})
