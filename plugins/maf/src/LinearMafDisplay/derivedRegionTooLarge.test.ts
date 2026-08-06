import { getMembers } from '@jbrowse/mobx-state-tree'

import { createMafTestEnvironment } from './testEnv.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport. These lock in the self-releasing behavior — a banner
// that clears on zoom-in (not stuck), doesn't flicker on pan, and a force-load
// that stays cleared even after a zoom-out (the invariant that once bit LD).
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

// The summary swap and the gate ask the same "how zoomed out am I" question, so
// `showSummary` reads the gate's own `aboveForceLoadFloor` rather than restating
// the threshold. These pin both directions of that read. `aboveForceLoadFloor`
// excludes every opt-in term, which is what keeps the read acyclic — the gate
// getters that read `showSummary` (`byteGateAdapterConfig`) sit downstream of it.
describe('MAF summary swap vs the force-load floor', () => {
  it('never summarizes without a summary adapter, however wide the view', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(true)
    expect(display.showSummary).toBe(false)
    // so the detail path is what gates
    expect(display.byteGateEnabled).toBe(true)
  })

  it('summarizes above the floor and swaps back to the gated detail path below it', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    // The summary tier is gated too — it is a whole-feature read, not a
    // zoom-reduced one — but against its own file, so a small summary read is
    // nowhere near the cap and never sees a banner.
    expect(display.byteGateEnabled).toBe(true)
    expect(display.gateActive).toBe(true)
    expect(display.byteGateAdapterConfig).toEqual({ type: 'BigBedAdapter' })

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(false)
    expect(display.showSummary).toBe(false)
    expect(display.byteGateEnabled).toBe(true)
  })

  it('summarizes nothing before the view is measured', () => {
    const { display } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay(/* unmeasured */ { skipWidth: true })
    expect(display.aboveForceLoadFloor).toBe(false)
    expect(display.showSummary).toBe(false)
  })
})

// MAF opts out of the AUTO_FORCE_LOAD_BP floor (`gateBelowForceLoadFloor`),
// because its bytes scale with span *times row count* — a 470-way pulls
// megabytes out of a gene-sized window, which is the fetch the floor declines to
// look at. These pin that the opt-out moved the gate and nothing else: the
// summary swap still happens at 20kb, and the verdict is still the estimate
// against the cap rather than a blanket "always gate when zoomed in".
describe('MAF gating below the force-load floor', () => {
  it('gates on an over-budget estimate even below the floor', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20) // visibleBp = 16_000 < AUTO_FORCE_LOAD_BP
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(false)

    // what the floor used to hide: a deep alignment is still megabytes here
    display.setByteEstimate({
      bytes: 3_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(true)
    expect(display.regionTooLargeReason).toBe('Requested too much data (3 Mb)')
  })

  it('still releases below the floor once the scaled estimate fits the cap', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20)
    display.setByteEstimate({
      bytes: 3_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // a quarter of the span → 750kB < the 1MB cap. The gate is still live down
    // here (that is the point of the opt-out), so this clears on the bytes, not
    // by falling off a threshold.
    view.zoomTo(5)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('is the estimate that decides, so a shallow alignment never gates down here', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20)
    // a 26-way over the same window: two orders of magnitude under the cap
    display.setByteEstimate({ bytes: 40_000, measuredSpanBp: view.visibleBp })
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('leaves the summary swap point at 20kb', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    // below the floor the gate is live but the summary tier has not kicked in:
    // where the cheap tier draws a better picture is a rendering question and
    // did not move with the byte gate.
    view.zoomTo(20)
    expect(display.showSummary).toBe(false)
    expect(display.gateActive).toBe(true)

    // and the swap still happens at 20kb, independently of the gate
    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
  })

  it('force-load still clears it below the floor', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20)
    display.setByteEstimate({
      bytes: 3_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.gateActive).toBe(false)
    expect(display.regionTooLarge).toBe(false)
  })

  it('gates nothing before the view is measured', () => {
    const { display } = createMafTestEnvironment().createDisplay({
      skipWidth: true,
    })
    expect(display.gateBelowForceLoadFloor).toBe(true)
    expect(display.gateActive).toBe(false)
    expect(display.regionTooLarge).toBe(false)
  })
})

// Both MAF tiers are gated, each against the file it actually reads
// (`byteGateAdapterConfig`). The summary tier used to be exempt on the grounds
// that it is the cheap one — but a `BigBedAdapter` read is a whole-feature
// download and `showSummary` covers every zoom from 20kb to the whole genome, so
// the exemption was the one path that could pull an unbounded number of records
// with no size quoted. These pin that the gate follows the swap.
describe('MAF measures the tier it is about to fetch', () => {
  it('measures the summary sub-adapter while summarizing', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(100)
    expect(display.showSummary).toBe(true)
    // not the MAF adapter: quoting the alignment's cost for a fetch nobody is
    // doing would block the cheap tier on the expensive one's number
    expect(display.byteGateAdapterConfig).toEqual({ type: 'BigBedAdapter' })
  })

  it('measures the MAF adapter itself below the swap point', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(20)
    expect(display.showSummary).toBe(false)
    expect(display.byteGateAdapterConfig).toMatchObject({
      type: 'MafTabixAdapter',
    })
  })

  it('measures the MAF adapter at every zoom when no summary is configured', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(400)
    expect(display.showSummary).toBe(false)
    expect(display.byteGateAdapterConfig).toMatchObject({
      type: 'MafTabixAdapter',
    })
  })

  it('gates an over-budget summary read instead of downloading it', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    // genome-scale: one record per species per aligned run adds up, and this is
    // the read that used to be exempt from the gate entirely
    view.zoomTo(2000)
    expect(display.showSummary).toBe(true)
    display.setByteEstimate({
      bytes: 20_000_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)
    expect(display.regionTooLargeReason).toBe('Requested too much data (20 Mb)')
  })

  it('leaves an ordinary summary read alone', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(100)
    // a real summary read at this zoom: no sequence, just per-species runs
    display.setByteEstimate({ bytes: 60_000, measuredSpanBp: view.visibleBp })
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })
})

describe('MAF derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // half the span → scaled estimate ~750kB < 1MB cap, still above the floor:
    // clears via the derived scaling, not the AUTO_FORCE_LOAD_BP shortcut.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // pan (same zoom) keeps it too large; the estimate is not cleared
    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load exempts the track and clears the banner', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom out: the scaled estimate grows past the raw captured bytes, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats and, because
  // FetchVisibleRegions gates on !regionTooLarge, wedge the banner permanently.
  it('clears the cached estimate on region navigation so it cannot wedge', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})
