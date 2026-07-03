import {
  OFFSCREEN_Y_SENTINEL,
  computeOverlayY,
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

describe('computeOverlayY', () => {
  const base = { yOffset: 1000, height: 200, coverageOffset: 40, scrollTop: 0 }

  test('off-display features snap to the track bottom edge', () => {
    expect(
      computeOverlayY({ ...base, layout: makeOffscreenLayout(100, 200) }),
    ).toBe(base.yOffset + base.height)
  })

  test('uses the layout rectangle vertical midpoint plus coverage offset', () => {
    // midpoint of [50,90] is 70, +40 coverage offset = 110
    expect(computeOverlayY({ ...base, layout: [0, 50, 0, 90] })).toBe(
      1000 + 110,
    )
  })

  test('vertical scroll shifts the endpoint up', () => {
    expect(
      computeOverlayY({ ...base, scrollTop: 30, layout: [0, 50, 0, 90] }),
    ).toBe(1000 + 80)
  })

  test('clamps up to the coverage offset when the midpoint is above it', () => {
    // scrolled so far that mid < coverageOffset -> pinned to coverageOffset
    expect(
      computeOverlayY({ ...base, scrollTop: 1000, layout: [0, 50, 0, 90] }),
    ).toBe(1000 + base.coverageOffset)
  })

  test('clamps down to the track height when the midpoint is below it', () => {
    expect(computeOverlayY({ ...base, layout: [0, 5000, 0, 5000] })).toBe(
      1000 + base.height,
    )
  })

  test('result always lands within [yOffset+coverageOffset, yOffset+height]', () => {
    for (const scrollTop of [-500, 0, 75, 5000]) {
      for (const top of [0, 60, 1000]) {
        const y = computeOverlayY({ ...base, scrollTop, layout: [0, top, 0, top + 20] })
        expect(y).toBeGreaterThanOrEqual(base.yOffset + base.coverageOffset)
        expect(y).toBeLessThanOrEqual(base.yOffset + base.height)
      }
    }
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
