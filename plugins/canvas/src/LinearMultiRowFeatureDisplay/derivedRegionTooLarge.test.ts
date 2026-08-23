import { getMembers } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// A committed region with nothing on it — presence is the whole question here.
function emptyRegionData(): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array(0),
    featureEnds: new Uint32Array(0),
    featureColors: new Uint32Array(0),
    featureDeltas: new Int32Array(0),
    partitionValues: [],
    featurePartitionIndex: new Uint32Array(0),
    featureNames: [],
    featureIds: [],
    usedItemRgb: false,
    partitionCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// CanvasFeatureGateMixin never sets `measuresBytesPreFlight` (it folds the byte check
// into its feature RPC instead of running the pre-flight), so the opt-in comes
// entirely from `measuresBytesInFetch`, which RegionTooLargeMixin ORs into
// `gateEnabled`. Additive, so the gate survives either
// composition order — this used to hinge on the mixin composing last, and
// swapping the two lines turned the whole byte/density gate off silently.
test('the gate opt-in survives regardless of mixin composition order', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.measuresBytesPreFlight).toBe(false)
  expect(display.gateEnabled).toBe(true)
})

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('regionHasData')
  expect(actions).not.toContain('rpcProps')
})

// A too-large region is marked loaded so the fetch autorun doesn't spin, and
// stores no rpcData — the presence hook is what refetches it once the gate
// releases. No zoom rule beside it: `regionFetchKey` stays at the mixin's empty
// default, so a zoom inside a loaded region reuses the features.
describe('the presence hook is the whole cache rule', () => {
  it('is invalid for a region the fetch stored nothing for', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setLoadedRegion(0, view.displayedRegions[0])
    expect(display.isCacheValid(0)).toBe(false)
  })

  it('stays valid through a zoom once the features are committed', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setLoadedRegion(0, view.displayedRegions[0])
    display.setRpcData(0, emptyRegionData())
    expect(display.isCacheValid(0)).toBe(true)

    view.zoomTo(view.bpPerPx / 4)
    expect(display.isCacheValid(0)).toBe(true)
  })
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
    // not a rate to scale by span. Stays above AUTO_FORCE_LOAD_BP so the
    // sub-floor budget tier isn't what this is measuring; the test below is.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)

    display.setByteEstimate({
      bytes: 1_600_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(false)
  })

  // Crossing AUTO_FORCE_LOAD_BP raises the budget by SUB_FLOOR_BYTE_BUDGET_FACTOR
  // rather than turning the byte axis off, so the same measured estimate can
  // release on zoom — the one thing zoom does to this axis. 8 Mb sits between
  // the two tiers of the 5 Mb display config, which is the case that moved.
  it('releases the same estimate below the force-load floor, on the budget tier', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 8_000_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.regionTooLarge).toBe(false)

    // and the axis is still live down there — it is a tier, not an off-switch
    display.setByteEstimate({
      bytes: 40_000_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)
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
      display.gateFetchState(),
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

  // ...and it does not claim to have *asked* about this viewport either. The
  // stamp `gateMeasurementStale` reads means "the gate asked the adapter", and a
  // force-loaded fetch carries no budget on either axis, so it asked nothing.
  // Stamping it anyway left a revoked track holding a stamp from fetches that
  // never measured, so the fetch autoruns would skip the one re-measure the
  // banner needs until the viewport moved. The pre-flight path always got this
  // right — `byteGateBlocksFetch` returns above its own stamp when the gate is
  // inactive — and the two paths have to mean the same thing by the stamp.
  it('does not stamp the viewport for a fetch the gate sat out', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setForceLoadTrack(true)

    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { featureCount: 12 },
        },
      ],
      display.gateFetchState(),
    )

    display.setForceLoadTrack(false)
    expect(display.gateMeasurementStale).toBe(true)
  })

  // Both halves of the batch guard, one at a time. A sweep found no test with
  // one term true and the other false, and each direction fails differently:
  // an empty batch would stamp a viewport nothing measured, and a batch with no
  // viewport to label it has nothing to stamp at all.
  it('commits nothing when either half of a batch is missing', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)

    display.commitGateMeasurements([], display.gateFetchState())
    expect(display.gateMeasurementStale).toBe(true)
    expect(display.byteEstimate).toBeUndefined()

    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { bytes: 8_000_000, featureCount: 12 },
        },
      ],
      { viewport: undefined, gated: true, tierKey: undefined },
    )
    expect(display.gateMeasurementStale).toBe(true)
    expect(display.byteEstimate).toBeUndefined()
    expect(display.densityStatsPerRegion.size).toBe(0)
  })

  // decided by the gate at ISSUE, not at commit: force-load can move between
  it('stamps a gated fetch even if force-load lands before the results do', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    // issued under the gate, so the worker really was handed a budget
    const issued = display.gateFetchState()
    expect(issued.gated).toBe(true)

    // ...and the user force-loads while it is in flight
    display.setForceLoadTrack(true)
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { bytes: 1000, featureCount: 12 },
        },
      ],
      issued,
    )

    // the measurement happened, so the viewport has been asked about
    display.setForceLoadTrack(false)
    expect(display.gateMeasurementStale).toBe(false)
  })

  it('does not stamp an unguarded fetch even if the gate is back on by then', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setForceLoadTrack(true)
    // issued with no budget on either axis: the worker measured against nothing
    const issued = display.gateFetchState()
    expect(issued.gated).toBe(false)

    // ...and the track is put back under the gate before the results land
    display.setForceLoadTrack(false)
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { featureCount: 12 },
        },
      ],
      issued,
    )

    // nothing was measured, so the next settled viewport still has to ask
    expect(display.gateMeasurementStale).toBe(true)
  })

  // The density stats are the deliberate exception: they are committed whatever
  // the budget was, which is what lets zooming back out re-gate from the live
  // main-thread verdict rather than waiting on a fresh worker rejection.
  it('still records density stats for a force-loaded fetch', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setForceLoadTrack(true)

    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000 },
          result: { featureCount: 12 },
        },
      ],
      display.gateFetchState(),
    )

    expect(display.densityStatsPerRegion.get(0)).toEqual({
      featureCount: 12,
      regionWidthBp: 10_000,
    })
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
      display.gateFetchState(),
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
      display.gateFetchState(),
    )
    expect(display.regionTooLarge).toBe(true)
    expect(display.resolvedByteLimit()).toBe(5_000_000)
  })

  // The half of a divergence that is a decision, not an accident, and the half
  // that has a harness — so it is pinned here and named on the other side in
  // `LDDisplay/derivedRegionTooLarge.test.ts`.
  //
  // Canvas measures one region per RPC and keeps the **max**: every region is
  // gated against the same per-region budget, so a multi-region view where each
  // region individually fits is never blanked by what they add up to. The
  // pre-flight path hands the whole region set to `getRegionByteSize` in one
  // call and gets the summed, chunk-merged total back, so on this same input it
  // banners. Two 3 Mb regions against a 5 Mb budget is the smallest case that
  // separates them, and the same VCF really does reach opposite verdicts
  // through `LinearVariantDisplay` and `LinearMultiSampleVariantDisplay`.
  //
  // Both readings are defensible — one is what the wire costs, the other is
  // what any single region costs — and neither is cheaply convertible to the
  // other. This is here so that changing either one fails rather than silently
  // flipping a documented decision. See REGION_TOO_LARGE.md § Canvas folds the
  // byte check into its fetch RPC.
  it('gates on the worst region, not the total, where the pre-flight sums', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgB' },
    ])
    view.moveTo({ index: 0, offset: 0 }, { index: 1, offset: 10_000_000 })

    const perRegion = 3_000_000
    display.commitGateMeasurements(
      [
        {
          displayedRegionIndex: 0,
          region: { start: 0, end: 10_000_000 },
          result: { bytes: perRegion },
        },
        {
          displayedRegionIndex: 1,
          region: { start: 0, end: 10_000_000 },
          result: { bytes: perRegion },
        },
      ],
      display.gateFetchState(),
    )

    expect(display.resolvedByteLimit()).toBe(5_000_000)
    // the max, not the 6 Mb sum
    expect(display.estimatedFetchBytes).toBe(perRegion)
    expect(display.regionTooLarge).toBe(false)
    // ...and the sum is what the other path would have compared, which is over
    expect(perRegion * 2).toBeGreaterThan(display.resolvedByteLimit()!)
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

  // The axis is on where something measures it. `RegionTooLargeMixin` defaults
  // it off, `CanvasFeatureGateMixin` contributes the `true`, and this display
  // takes it back off in its own `.views` — which is what makes the override
  // independent of mixin order. Nothing else pins the per-display default:
  // `gateTruthTable` overrides the hook to enumerate it, so it cannot see which
  // way the base points.
  it('turns the contributed density axis back off, in compose order', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    settle(view)
    expect(display.gateActive).toBe(true)
    expect(display.aboveForceLoadFloor).toBe(true)
    // ...so the only term left holding the axis off is this display's own
    expect(display.densityGateEnabled).toBe(false)
    expect(display.densityGateActive).toBe(false)
  })
})
