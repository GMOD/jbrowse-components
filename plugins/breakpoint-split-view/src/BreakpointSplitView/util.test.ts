import {
  OFFSCREEN_Y_SENTINEL,
  findFeatureViewLevel,
  isOffscreenLayout,
  makeOffscreenLayout,
} from './util.ts'

describe('makeOffscreenLayout / isOffscreenLayout', () => {
  test('round-trips through the predicate', () => {
    const c = makeOffscreenLayout(100, 200)
    expect(isOffscreenLayout(c)).toBe(true)
    expect(c[0]).toBe(100)
    expect(c[2]).toBe(200)
    expect(c[1]).toBe(OFFSCREEN_Y_SENTINEL)
    expect(c[3]).toBe(OFFSCREEN_Y_SENTINEL)
  })

  test('a real layout with finite y is not offscreen', () => {
    expect(isOffscreenLayout([100, 0, 200, 8])).toBe(false)
    expect(isOffscreenLayout([100, 1199, 200, 1200])).toBe(false)
  })
})

describe('findFeatureViewLevel', () => {
  // Stub views: bpToPx returns truthy only for refNames it owns.
  const make = (refs: string[]) => ({
    bpToPx: ({ refName }: { refName: string; coord: number }) =>
      refs.includes(refName) ? { offsetPx: 0 } : undefined,
  })

  test('returns the first level whose view contains the feature refName', () => {
    const views = [make(['chr1']), make(['chr2'])]
    expect(findFeatureViewLevel(views, 'chr2', 500)).toBe(1)
  })

  test('returns the lower index when both views contain the refName', () => {
    const views = [make(['chr1', 'chr2']), make(['chr2'])]
    expect(findFeatureViewLevel(views, 'chr2', 500)).toBe(0)
  })

  test('returns undefined when no view contains the refName', () => {
    const views = [make(['chr1']), make(['chr2'])]
    expect(findFeatureViewLevel(views, 'chrUn', 0)).toBeUndefined()
  })
})
