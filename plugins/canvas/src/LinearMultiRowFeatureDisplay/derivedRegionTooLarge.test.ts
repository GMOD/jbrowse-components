import { getMembers } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'

// CanvasFeatureGateMixin never sets `byteGateEnabled` (it folds the byte check
// into its feature RPC instead of running the pre-flight), so the opt-in comes
// entirely from `gateFoldedIntoFetch`, which RegionTooLargeMixin ORs into
// `derivedRegionTooLargeEnabled`. Additive, so the gate survives either
// composition order — this used to hinge on the mixin composing last, and
// swapping the two lines turned the whole byte/density gate off silently.
test('the gate opt-in survives regardless of mixin composition order', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.byteGateEnabled).toBe(false)
  expect(display.derivedRegionTooLargeEnabled).toBe(true)
})

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

describe('multi-row derived regionTooLarge (byte axis)', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured byte estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp > AUTO_FORCE_LOAD_BP
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    }) // over the 5MB config
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(20)
    expect(display.regionTooLarge).toBe(false)
  })

  // Regression: the estimate must be anchored to the span it was MEASURED over,
  // not to whatever is on screen when the reply lands. The two coincide at a
  // settled viewport, which is why every other test here can't tell them apart —
  // this one zooms between the measurement and the commit so they diverge. Both
  // spans stay above AUTO_FORCE_LOAD_BP so the floor isn't what clears the
  // banner. Re-anchored at commit time the estimate would read the full 7.5MB,
  // stay over the 5MB cap, and wedge: `FetchVisibleRegions` skips while
  // `regionTooLarge` holds, so nothing would refetch to correct it.
  it('anchors the estimate to the measured span, not the span at commit time', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(200)
    const measuredSpanBp = view.visibleBp

    // the user keeps zooming while the fetch is in flight
    view.zoomTo(100)
    expect(view.visibleBp).toBeLessThan(measuredSpanBp)
    expect(view.visibleBp).toBeGreaterThan(20_000)

    display.setByteEstimate({
      bytes: 7_500_000,
      measuredSpanBp: measuredSpanBp,
    })

    expect(display.byteEstimate?.measuredSpanBp).toBe(measuredSpanBp)
    expect(display.estimatedBytesForVisibleSpan).toBeCloseTo(
      (7_500_000 * view.visibleBp) / measuredSpanBp,
    )
    expect(display.resolvedByteLimit()).toBe(5_000_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('honors an adapter-declared fetchSizeLimit over the display config', () => {
    const { display, view } = createTestEnvironment({
      adapterFetchSizeLimit: 50_000_000,
    }).createDisplay()
    view.zoomTo(100)
    // 8MB is over the 5MB display config but under the 50MB adapter limit
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.resolvedByteLimit()).toBe(50_000_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load exempts the track and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    display.forceLoad()
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    expect(display.resolvedByteLimit()).toBeUndefined()
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    // and the worker gate goes unlimited so the forced fetch isn't re-blocked
    expect(display.resolvedByteLimit()).toBeUndefined()
  })

  it('clears the cached estimate on region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // MultiRegionDisplayMixin's DisplayedRegionsChange autorun drops the
    // estimate; the gate mixin drops the per-region density stats on the same
    // trigger.
    display.clearByteEstimate()
    display.clearGateMeasurements()
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })

  // A fetch issued while the gate is inactive (under the force-load floor, or
  // force-loaded) hands the worker no byte budget, so the worker measures
  // nothing and every result comes back with `bytes: undefined`. That is "not
  // measured", not "measured as unmeasurable" — committing it would wipe a good
  // estimate, and the next zoom back out would have no verdict to raise the
  // banner from until a fresh worker rejection came back. The pre-flight path
  // never had this: `byteGateBlocksFetch` skips the RPC and writes nothing.
  it('keeps a good estimate when a batch measured no bytes', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    const measuredSpanBp = view.visibleBp
    display.setByteEstimate({ bytes: 8_000_000, measuredSpanBp })
    expect(display.regionTooLarge).toBe(true)

    // zoom under AUTO_FORCE_LOAD_BP: nothing gates, so the fetch carries no
    // budget and the worker reports no bytes
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.resolvedByteLimit()).toBeUndefined()
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { featureCount: 12 },
        },
      ],
      view.visibleBp,
    )
    expect(display.byteEstimate).toEqual({ bytes: 8_000_000, measuredSpanBp })

    // so zooming back out raises the banner straight off the kept estimate,
    // with no round trip
    view.zoomTo(100)
    expect(display.regionTooLarge).toBe(true)
  })

  it('keeps force-load across region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      measuredSpanBp: view.visibleBp,
    })
    display.forceLoad()

    // track-wide approval, so the nav clears survive it
    display.clearByteEstimate()
    display.clearGateMeasurements()
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })
})

// The in-fetch (canvas) path commits ONE estimate for a region set: the
// per-region byte **max**, anchored to the **total** visibleBp across the visible
// regions. Those are different denominators, and this test pins the consequence
// rather than fixing it, because both routes out are worse:
//
//   - Anchoring to the fetched region's own span would understate the estimate at
//     capture time — canvas fetches `bufferedVisibleRegions` (a half-screen of
//     buffer each side), so the bytes cover roughly twice the span on screen. The
//     banner would clear a region the worker's per-region gate still rejects,
//     which is the wedge the anchoring rules exist to prevent.
//   - Keeping a per-region rate would give canvas a different estimate semantic
//     from the pre-flight path, which genuinely measures a region *set* in one
//     adapter call and has no per-region number to keep.
//
// What the mismatch costs: in a multi-region (whole-genome) view, zooming into one
// chromosome shrinks the total span faster than that chromosome's own bytes
// shrink, so the banner releases early. The download stays protected — the worker
// re-gates each region on the next fetch and the banner comes back — so the
// symptom is one extra round trip and a banner flicker, not an unguarded fetch.
describe('multi-region rescale denominator (accepted behavior)', () => {
  it('releases early when the visible region set shrinks, and the worker budget still gates', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgB' },
    ])

    // whole-genome view: both 10 Mb regions on screen, 20 Mb total
    view.moveTo({ index: 0, offset: 0 }, { index: 1, offset: 10_000_000 })
    expect(view.visibleBp).toBe(20_000_000)

    // ctgA's fetch reports 20 Mb of index, ctgB's a tenth of that. The gate
    // keeps the max (each region is gated against the same per-region budget)
    // with the total span as its anchor.
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000_000 },
          result: { bytes: 20_000_000 },
        },
        {
          displayedRegionIndex: 1,
          region: { start: 0, end: 10_000_000 },
          result: { bytes: 2_000_000 },
        },
      ],
      view.visibleBp,
    )
    expect(display.byteEstimate).toEqual({
      bytes: 20_000_000,
      measuredSpanBp: 20_000_000,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom into 4 Mb of ctgA alone: the total span fell 5x, so the estimate
    // rescales to 4 Mb and clears the 5 Mb budget...
    view.moveTo({ index: 0, offset: 0 }, { index: 0, offset: 4_000_000 })
    expect(view.visibleBp).toBe(4_000_000)
    expect(display.estimatedBytesForVisibleSpan).toBeCloseTo(4_000_000)
    expect(display.regionTooLarge).toBe(false)

    // ...where ctgA's own span fell only 2.5x: a per-region denominator would
    // read 8 Mb and keep the banner up. That is the accepted gap. What still
    // holds is the worker budget the next fetch enforces per region, so the
    // release costs a round trip rather than an unguarded download.
    expect(display.resolvedByteLimit()).toBe(5_000_000)
  })
})

describe('multi-row derived regionTooLarge (density axis)', () => {
  // Density is a live max over visible regions at coarseBpPerPx, so settle the
  // debounced coarse blocks the gate reads after each zoom.
  function settle(view: { dynamicBlocks: unknown; bpPerPx: number }) {
    ;(
      view as unknown as {
        setCoarseDynamicBlocks: (b: unknown, bp: number) => void
      }
    ).setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  }

  // Multi-row disables the density axis (densityGateEnabled): it paints features
  // into fixed lanes, so a high total feature count is not a per-glyph render
  // cost — only the byte/download budget gates it. The "Too many features"
  // banner must never show here regardless of density.
  it('never trips on density even at an extreme feature count', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    settle(view)
    // a dense region that would trip the default maxFeatureScreenDensity of 1
    display.setDensityStats(0, {
      featureCount: 500_000,
      regionWidthBp: 10_000_000,
    })
    expect(display.maxFeatureDensity).toBeUndefined()
    expect(display.densityTooLarge).toBe(false)
    expect(display.regionTooLarge).toBe(false)
  })
})
