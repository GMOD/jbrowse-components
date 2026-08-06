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
      viewport: display.gateViewport!,
    }) // over the 5MB config
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('releases when a re-measure comes back under the cap', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom alone is not a verdict — the stored figure is what the index quoted,
    // not a rate to scale by span
    view.zoomTo(20)
    expect(display.regionTooLarge).toBe(true)

    display.setByteEstimate({ bytes: 1_600_000, viewport: display.gateViewport! })
    expect(display.regionTooLarge).toBe(false)
  })

  // The estimate carries the span it was MEASURED over, not whatever is on
  // screen when the reply lands. The two coincide at a settled viewport, which
  // is why every other test here can't tell them apart — this one zooms between
  // the measurement and the commit so they diverge. Nothing divides by that span
  // any more, but `zoomIneffective` compares consecutive ones, so labelling a
  // measurement with a span it never covered would make the next zoom look like
  // it bought nothing and drop "zoom in to see features" off the banner.
  it('labels the estimate with the measured span, not the span at commit time', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(200)
    const issued = display.gateViewport!

    // the user keeps zooming while the fetch is in flight
    view.zoomTo(100)
    expect(view.visibleBp).toBeLessThan(issued.spanBp)

    display.setByteEstimate({ bytes: 7_500_000, viewport: issued })

    expect(display.byteEstimate?.measuredSpanBp).toBe(issued.spanBp)
    expect(display.estimatedFetchBytes).toBe(7_500_000)
    expect(display.resolvedByteLimit()).toBe(5_000_000)
    expect(display.regionTooLarge).toBe(true)
    // the mid-fetch zoom is not evidence about zoom, because the number it
    // produced describes the wider span
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  it('honors an adapter-declared fetchSizeLimit over the display config', () => {
    const { display, view } = createTestEnvironment({
      adapterFetchSizeLimit: 50_000_000,
    }).createDisplay()
    view.zoomTo(100)
    // 8MB is over the 5MB display config but under the 50MB adapter limit
    display.setByteEstimate({
      bytes: 8_000_000,
      viewport: display.gateViewport!,
    })
    expect(display.resolvedByteLimit()).toBe(50_000_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load exempts the track and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      viewport: display.gateViewport!,
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
      viewport: display.gateViewport!,
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
      viewport: display.gateViewport!,
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

  // A fetch issued while the byte gate is inactive — force-loaded — hands the
  // worker no budget, so the worker measures nothing and every result comes back
  // with `bytes: undefined`. That is "not measured", not "measured as
  // unmeasurable": committing it would wipe a good estimate, and putting the
  // track back under the gate would have no verdict to raise the banner from
  // until a fresh worker rejection came back. It would also reset the
  // zoom-effectiveness comparison, which needs two real measurements. The
  // pre-flight path never had this — `byteGateBlocksFetch` skips the RPC and
  // writes nothing.
  it('keeps a good estimate when a batch measured no bytes', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    const issued = display.gateViewport!
    display.setByteEstimate({ bytes: 8_000_000, viewport: issued })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.resolvedByteLimit()).toBeUndefined()
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { featureCount: 12 },
        },
      ],
      display.gateViewport!,
    )
    expect(display.byteEstimate).toEqual({
      bytes: 8_000_000,
      measuredSpanBp: issued.spanBp,
      zoomIneffective: false,
    })

    // so putting the track back under the gate raises the banner straight off
    // the kept estimate, with no round trip
    display.setForceLoadTrack(false)
    expect(display.regionTooLarge).toBe(true)
  })

  it('keeps force-load across region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      viewport: display.gateViewport!,
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
// per-region byte **max** (each region is gated against the same per-region
// budget, so a multi-region view where every region individually fits is never
// blanked by the cross-region total), labelled with the **total** visibleBp
// across the visible regions.
//
// Those used to be different denominators of a division, and the mismatch was
// recorded here as accepted behavior: zooming into one chromosome shrank the
// total span faster than that chromosome's own bytes shrank, so the banner
// released a region the worker still refused, costing a round trip and a
// flicker. There is no division any more — the span is a label, not a
// denominator — so the whole mismatch is gone. Zooming into one chromosome
// leaves the verdict alone and the while-gated re-measure decides it on the
// region set actually on screen.
describe('multi-region estimates over a shrinking region set', () => {
  it('does not release on a shrinking region set until a re-measure says so', () => {
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
    // keeps the max, labelled with the total span.
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
      display.gateViewport!,
    )
    expect(display.byteEstimate).toMatchObject({
      bytes: 20_000_000,
      measuredSpanBp: 20_000_000,
      zoomIneffective: false,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom into 4 Mb of ctgA alone. The total span fell 5x, which under the old
    // rescale read as 4 Mb and cleared the 5 Mb budget — for a region whose own
    // bytes had fallen only 2.5x and which the worker would have refused again.
    view.moveTo({ index: 0, offset: 0 }, { index: 0, offset: 4_000_000 })
    expect(view.visibleBp).toBe(4_000_000)
    expect(display.estimatedFetchBytes).toBe(20_000_000)
    expect(display.regionTooLarge).toBe(true)

    // it releases on a measurement of what is actually on screen now
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 4_000_000 },
          result: { bytes: 8_000_000 },
        },
      ],
      display.gateViewport!,
    )
    expect(display.regionTooLarge).toBe(true)
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
