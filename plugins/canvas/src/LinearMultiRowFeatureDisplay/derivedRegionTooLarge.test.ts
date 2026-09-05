import { stageByteEstimate } from '@jbrowse/display-test-utils'
import { getMembers } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment, ctgA } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

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
    partitionCandidateValues: [],
    legendCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// The display declares the byte-gate opt-in itself; `RegionTooLargeMixin`
// defaults it off, and losing the override turns the whole gate off silently.
test('the display opts into the byte gate', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.gateEnabled).toBe(true)
})

// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer.
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('regionHasData')
  expect(actions).not.toContain('rpcProps')
})

// A too-large region is marked loaded so the fetch autorun does not spin, and
// stores no rpcData — the presence hook is what refetches it once the gate
// releases.
describe('the presence hook is the whole cache rule', () => {
  it('is invalid for a region the fetch stored nothing for', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setLoadedRegion(0, view.displayedRegions[0], undefined)
    expect(display.isCacheValid(0)).toBe(false)
  })

  it('stays valid through a zoom once the features are committed', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    display.setRpcData(0, emptyRegionData(), ctgA)
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
    stageByteEstimate(display, 8_000_000) // over the 5MB config
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('releases when a re-measure comes back under the cap', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 8_000_000)
    expect(display.regionTooLarge).toBe(true)

    // Zoom alone is not a verdict: the stored figure is what the index quoted,
    // not a rate to scale by span. Stays above AUTO_FORCE_LOAD_BP so the
    // sub-floor budget tier is not what this measures.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)

    stageByteEstimate(display, 1_600_000)
    expect(display.regionTooLarge).toBe(false)
  })

  // Crossing AUTO_FORCE_LOAD_BP raises the budget by SUB_FLOOR_BYTE_BUDGET_FACTOR
  // rather than turning the byte axis off, so the same measured estimate can
  // release on zoom.
  it('releases the same estimate below the force-load floor, on the budget tier', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 8_000_000)
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.regionTooLarge).toBe(false)

    // ...and the axis is still live down there: a tier, not an off-switch.
    stageByteEstimate(display, 40_000_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // The estimate carries the span it was measured over, not whatever is on
  // screen when the reply lands. `zoomIneffective` compares consecutive spans,
  // so labelling a measurement with a span it never covered makes the next zoom
  // look like it bought nothing.
  it('labels the estimate with the measured span, not the span at commit time', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(200)
    const issued = display.gateViewport!

    // The user keeps zooming while the fetch is in flight.
    view.zoomTo(100)
    expect(view.visibleBp).toBeLessThan(issued.spanBp)

    display.commitFetchBytes([7_500_000], {
      viewport: issued,
      gated: false,
      tierKey: undefined,
    })

    expect(display.byteEstimate?.measuredSpanBp).toBe(issued.spanBp)
    expect(display.estimatedFetchBytes).toBe(7_500_000)
    expect(display.resolvedByteLimit()).toBe(5_000_000)
    expect(display.regionTooLarge).toBe(true)
    // The mid-fetch zoom is not evidence about zoom: the number it produced
    // describes the wider span.
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  it('honors an adapter-declared fetchSizeLimit over the display config', () => {
    const { display, view } = createTestEnvironment({
      adapterFetchSizeLimit: 50_000_000,
    }).createDisplay()
    view.zoomTo(100)
    // 8MB is over the 5MB display config but under the 50MB adapter limit.
    stageByteEstimate(display, 8_000_000)
    expect(display.resolvedByteLimit()).toBe(50_000_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load exempts the track and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 8_000_000)
    expect(display.regionTooLarge).toBe(true)

    display.forceLoad()
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    expect(display.resolvedByteLimit()).toBeUndefined()
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 8_000_000)
    expect(display.regionTooLarge).toBe(true)

    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    // ...and the worker gate goes unlimited so the forced fetch is not
    // re-blocked.
    expect(display.resolvedByteLimit()).toBeUndefined()
  })

  it('clears the cached estimate on region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 8_000_000)
    expect(display.regionTooLarge).toBe(true)

    display.clearByteEstimate()
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })

  // A force-loaded fetch hands the worker no budget, so every result comes back
  // with `bytes: undefined`. That is "not measured", not "measured as
  // unmeasurable" — committing it would wipe a good estimate and leave the gate
  // with no verdict to raise the banner from.
  it('keeps a good estimate when a batch measured no bytes', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    const issued = display.gateViewport!
    display.commitFetchBytes([8_000_000], {
      viewport: issued,
      gated: false,
      tierKey: undefined,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.resolvedByteLimit()).toBeUndefined()
    display.commitFetchBytes([undefined], display.gateFetchState())
    expect(display.byteEstimate).toEqual({
      bytes: 8_000_000,
      measuredSpanBp: issued.spanBp,
      zoomIneffective: false,
    })

    // ...so putting the track back under the gate raises the banner straight
    // off the kept estimate, with no round trip.
    display.setForceLoadTrack(false)
    expect(display.regionTooLarge).toBe(true)
  })

  // The stamp `gateMeasurementStale` reads means "the gate asked the adapter",
  // and a force-loaded fetch carries no budget on either axis, so it asked
  // nothing.
  it('does not stamp the viewport for a fetch the gate sat out', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setForceLoadTrack(true)

    display.commitFetchBytes([undefined], display.gateFetchState())

    display.setForceLoadTrack(false)
    expect(display.gateMeasurementStale).toBe(true)
  })

  // Both halves of the batch guard, one at a time: an empty batch would stamp a
  // viewport nothing measured, and a batch with no viewport to label it has
  // nothing to stamp at all.
  it('commits nothing when either half of a batch is missing', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)

    display.commitFetchBytes([], display.gateFetchState())
    expect(display.gateMeasurementStale).toBe(true)
    expect(display.byteEstimate).toBeUndefined()

    const unlabelled = { viewport: undefined, gated: true, tierKey: undefined }
    display.commitFetchBytes([8_000_000], unlabelled)
    expect(display.gateMeasurementStale).toBe(true)
    expect(display.byteEstimate).toBeUndefined()
  })

  // Decided by the gate at issue, not at commit: force-load can move between
  it('stamps a gated fetch even if force-load lands before the results do', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    // Issued under the gate, so the worker really was handed a budget.
    const issued = display.gateFetchState()
    expect(issued.gated).toBe(true)

    // ...and the user force-loads while it is in flight.
    display.setForceLoadTrack(true)
    display.commitFetchBytes([1000], issued)

    // The measurement happened, so the viewport has been asked about.
    display.setForceLoadTrack(false)
    expect(display.gateMeasurementStale).toBe(false)
  })

  it('does not stamp an unguarded fetch even if the gate is back on by then', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setForceLoadTrack(true)
    // Issued with no budget on either axis: the worker measured against
    // nothing.
    const issued = display.gateFetchState()
    expect(issued.gated).toBe(false)

    // ...and the track is put back under the gate before the results land.
    display.setForceLoadTrack(false)
    display.commitFetchBytes([undefined], issued)

    // Nothing was measured, so the next settled viewport still has to ask.
    expect(display.gateMeasurementStale).toBe(true)
  })

  it('keeps force-load across region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 8_000_000)
    display.forceLoad()

    // Track-wide approval, so the nav clears survive it.
    display.clearByteEstimate()
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })
})

// A fetch commits one estimate for a region set: the per-region byte max,
// labelled with the total visibleBp across the visible regions. The span is a
// label rather than a denominator, so zooming into one chromosome leaves the
// verdict alone and the while-gated re-measure decides it.
describe('multi-region estimates over a shrinking region set', () => {
  it('does not release on a shrinking region set until a re-measure says so', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgB' },
    ])

    // Whole-genome view: both 10 Mb regions on screen, 20 Mb total.
    view.moveTo({ index: 0, offset: 0 }, { index: 1, offset: 10_000_000 })
    expect(view.visibleBp).toBe(20_000_000)

    // ctgA's fetch reports 20 Mb of index, ctgB's a tenth of that. The gate
    // keeps the max, labelled with the total span.
    display.commitFetchBytes([20_000_000, 2_000_000], display.gateFetchState())
    expect(display.byteEstimate).toMatchObject({
      bytes: 20_000_000,
      measuredSpanBp: 20_000_000,
      zoomIneffective: false,
    })
    expect(display.regionTooLarge).toBe(true)

    // Zoom into 4 Mb of ctgA alone: the total span falls 5x while that region's
    // own bytes fall only 2.5x.
    view.moveTo({ index: 0, offset: 0 }, { index: 0, offset: 4_000_000 })
    expect(view.visibleBp).toBe(4_000_000)
    expect(display.estimatedFetchBytes).toBe(20_000_000)
    expect(display.regionTooLarge).toBe(true)

    // It releases on a measurement of what is actually on screen now.
    display.commitFetchBytes([8_000_000], display.gateFetchState())
    expect(display.regionTooLarge).toBe(true)
    expect(display.resolvedByteLimit()).toBe(5_000_000)
  })

  // The budget is what one region may cost, so a multi-region view where each
  // region individually fits is never blanked by what they add up to.
  it('gates on the worst region, not the total', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, view } = createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgB' },
    ])
    view.moveTo({ index: 0, offset: 0 }, { index: 1, offset: 10_000_000 })

    const perRegion = 3_000_000
    display.commitFetchBytes([perRegion, perRegion], display.gateFetchState())

    expect(display.resolvedByteLimit()).toBe(5_000_000)
    // The max, not the 6 Mb sum.
    expect(display.estimatedFetchBytes).toBe(perRegion)
    expect(display.regionTooLarge).toBe(false)
    // ...and the sum is what the other path would have compared, which is over
    // the limit.
    expect(perRegion * 2).toBeGreaterThan(display.resolvedByteLimit()!)
  })
})
