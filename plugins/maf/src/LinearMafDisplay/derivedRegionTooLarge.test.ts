import { getMembers } from '@jbrowse/mobx-state-tree'
import { makeFetchContext } from '@jbrowse/plugin-linear-genome-view'

import { createMafTestEnvironment } from './testEnv.ts'

// Byte figures here are "comfortably over" the display's own budget rather than
// literals. Thirteen assertions in this file were written against the base 1 Mb
// LinearMafDisplay used to inherit and all thirteen had to move when it declared
// its own 5 Mb — none of them was ever about a particular number of bytes.
//
// The x4 clears the sub-floor tier too (`SUB_FLOOR_BYTE_BUDGET_FACTOR` doubles
// the budget under `AUTO_FORCE_LOAD_BP`), so a test may cross 20kb without the
// value having to be re-chosen for whichever side it lands on.
const over = (display: { gateByteLimit: number }) => display.gateByteLimit * 4

// Derived regionTooLarge: a pure function of the cached byte estimate, which the
// fetch autoruns keep describing the current viewport by re-measuring while the
// banner holds. These lock in the behaviors around that — a banner that doesn't
// flicker on pan, one that waits for a measurement rather than releasing on
// arithmetic, and a force-load that stays cleared even after a bigger
// re-measure (the invariant that once bit LD).
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createMafTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('regionHasData')
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
    expect(display.measuresBytesPreFlight).toBe(true)
  })

  // A byte-only display has no features-per-pixel number, so it must not claim
  // the density axis. It used to: `densityGateEnabled` defaulted true, which put
  // maf, alignments, arc, LD and multi-sample-variant permanently in
  // `densityGateActive === true` — inert, since their `densityTooLarge` is the
  // base false, and a state that reads as the opposite of the truth.
  it('claims no density axis, having no density to measure', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    // every other term for the axis is satisfied here
    expect(display.gateActive).toBe(true)
    expect(display.aboveForceLoadFloor).toBe(true)
    expect(display.densityGateEnabled).toBe(false)
    expect(display.densityGateActive).toBe(false)
    expect(display.densityTooLarge).toBe(false)
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
    expect(display.measuresBytesPreFlight).toBe(true)
    expect(display.gateActive).toBe(true)
    expect(display.byteGateAdapterConfig).toEqual({ type: 'BigBedAdapter' })

    view.zoomTo(20)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(false)
    expect(display.showSummary).toBe(false)
    expect(display.measuresBytesPreFlight).toBe(true)
  })

  it('summarizes nothing before the view is measured', () => {
    const { display } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay(/* unmeasured */ { skipWidth: true })
    expect(display.aboveForceLoadFloor).toBe(false)
    expect(display.showSummary).toBe(false)
  })
})

// The byte axis has no span floor. It used to, and MAF was one of two displays
// that opted out of it one at a time, because its bytes cost span *times row
// count* — a 470-way pulls megabytes out of a gene-sized window, which is the
// fetch the floor declined to look at. The floor is gone for everyone now: the
// gate re-measures at whatever is on screen, so "a small span is a small fetch"
// is checked rather than assumed. These pin that removing it moved the gate and
// nothing else — the summary swap still happens at 20kb, and the verdict is
// still the estimate against the cap rather than a blanket "always gate when
// zoomed in".
describe('MAF gating below the force-load floor', () => {
  it('gates on an over-budget estimate even below the floor', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20) // visibleBp = 16_000 < AUTO_FORCE_LOAD_BP
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.aboveForceLoadFloor).toBe(false)

    // what the floor used to hide: a deep alignment is still megabytes here
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(true)
    expect(display.regionTooLargeReason).toBe(
      `Requested too much data (${over(display) / 1_000_000} Mb)`,
    )
  })

  // The verdict is the measurement, so zooming alone does not move it — what
  // moves it is the next measurement, which the fetch autorun takes on the
  // settled viewport while the banner holds. Scaling the stored number by
  // `visibleBp` is what this replaced, and it released the banner against a
  // figure the index never charges.
  it('holds the verdict until a fresh measurement moves it', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(5)
    expect(display.gateActive).toBe(true)
    expect(display.estimatedFetchBytes).toBe(over(display))
    expect(display.regionTooLarge).toBe(true)

    // the re-measure lands: the index really does quote the same blocks down
    // here, so the banner stays — and now it also stops advertising zoom
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)
    expect(display.zoomCanReleaseGate).toBe(false)
  })

  // ...and the same mechanism releases it when the bytes really do fall, at any
  // zoom, without a threshold anywhere in the path.
  it('releases when a re-measure comes back under the cap', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    display.setByteEstimate({ bytes: 700_000, viewport: display.gateViewport! })
    expect(display.regionTooLarge).toBe(false)
    expect(display.zoomCanReleaseGate).toBe(true)
  })

  // The budget itself, since MAF's is the whole gate: no MAF adapter declares a
  // `fetchSizeLimit`, and `densityTooLarge` is canvas's override so there is no
  // second axis behind it. Sizes from MAF_LARGE_BLOCKS.md § "Fetch dominates at
  // 470-way" — a 40kb buffered window is 5.3 MB uncompressed at 100 rows and
  // 25.1 MB at 470, against a measured 2.9–4.0x compression, so ~1.3–1.8 MB and
  // ~6–8 MB on the wire. On the base 1 Mb this display used to inherit, the
  // 100-way bannered a window it renders at 38–55fps.
  const HUNDRED_WAY_BYTES = Math.round(5_300_000 / 2.9)
  const FOUR_SEVENTY_WAY_BYTES = Math.round(25_100_000 / 4)

  it('lets both an ordinary multiz and a 470-way through at gene scale', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(20)
    expect(display.aboveForceLoadFloor).toBe(false)

    display.setByteEstimate({
      bytes: HUNDRED_WAY_BYTES,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(false)

    // The 470-way too, and deliberately: sub-floor it is the same category as
    // any other deep data at a locus the user navigated to on purpose, and the
    // ~6–8 MB is comparable to the ultradeep BAM the tier was sized against.
    display.setByteEstimate({
      bytes: FOUR_SEVENTY_WAY_BYTES,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(false)
  })

  // Above the floor the 470-way is stopped, which is where stopping it helps:
  // that is the zoom range `summaryAdapter` covers, and MAF_LARGE_BLOCKS.md's
  // answer for that row count is the summary tier rather than a raised budget.
  it('still stops a 470-way once the view is wide enough for the summary tier', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    expect(display.aboveForceLoadFloor).toBe(true)

    display.setByteEstimate({
      bytes: FOUR_SEVENTY_WAY_BYTES,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // and the ordinary multiz is still nowhere near it
    display.setByteEstimate({
      bytes: HUNDRED_WAY_BYTES,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(false)
  })

  it('is the estimate that decides, so a shallow alignment never gates down here', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20)
    // a 26-way over the same window: two orders of magnitude under the cap
    display.setByteEstimate({ bytes: 40_000, viewport: display.gateViewport! })
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
      bytes: over(display),
      viewport: display.gateViewport!,
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
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)
    expect(display.regionTooLargeReason).toBe('Requested too much data (20 Mb)')
  })

  // The estimate is about a fetch, and past the swap it is about a fetch nobody
  // is making — the alignment's megabytes quoted for a summary read that would
  // have measured ~60 kB. `RegionTooLargeMixin`'s ClearByteEstimateOnTierSwap
  // autorun drops it, the same rule chromosome nav applies on the other axis.
  // The while-gated re-measure would correct it a beat later, but only after the
  // banner had already shown the wrong number against the wrong file.
  it('drops the detail estimate when the view zooms out into the summary tier', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(20)
    expect(display.showSummary).toBe(false)
    // a 470-way over a gene-sized window, captured against the MAF adapter
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom out past the swap: the fetch about to happen is now the summary one
    view.zoomTo(200)
    expect(display.showSummary).toBe(true)
    expect(display.byteEstimate).toBeUndefined()
    // ...so the banner is gone and the pre-flight can measure the tier we're
    // actually about to read, rather than quoting ~29 Mb of alignment for it
    expect(display.regionTooLarge).toBe(false)
  })

  it('drops the summary estimate when the view zooms back into the detail tier', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(200)
    expect(display.showSummary).toBe(true)
    display.setByteEstimate({ bytes: 60_000, viewport: display.gateViewport! })

    view.zoomTo(20)
    expect(display.showSummary).toBe(false)
    expect(display.byteEstimate).toBeUndefined()
  })

  // A fetch in flight across the swap is the tier-swap clear's blind spot: its
  // measurement was issued against the detail tier, and committing it after
  // the swap would re-instate the very number ClearByteEstimateOnTierSwap just
  // dropped — the fetch autoruns skip while a fetch is in flight, so nothing
  // rotates the token at the crossing. The commit is judged by the tier
  // captured at issue (`GateFetchState.tierKey`), the same rule the viewport
  // capture already applies on the region axis.
  it('drops an in-flight detail measurement that lands after the swap', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(20)
    expect(display.showSummary).toBe(false)
    const issued = display.gateFetchState()
    const bytes = over(display)

    // the zoom lands while the measurement RPC is out
    view.zoomTo(200)
    expect(display.showSummary).toBe(true)

    display.commitByteMeasurement({
      ...issued,
      viewport: issued.viewport!,
      bytes,
    })
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)

    // and the same commit against the live tier still lands — the guard is
    // about the tier, not about commits
    const current = display.gateFetchState()
    display.commitByteMeasurement({
      ...current,
      viewport: current.viewport!,
      bytes: 60_000,
    })
    expect(display.byteEstimate?.bytes).toBe(60_000)
  })

  // The clear is keyed on the tier, not on the zoom: a track with no summary
  // adapter reads one file at every zoom, so its estimate has to survive the
  // 20kb crossing or the banner would re-derive itself on every pass.
  it('keeps the estimate across 20kb when there is no tier to swap to', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(20)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })

    view.zoomTo(200)
    expect(display.showSummary).toBe(false)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('leaves an ordinary summary read alone', () => {
    const { display, view } = createMafTestEnvironment({
      summaryAdapter: { type: 'BigBedAdapter' },
    }).createDisplay()

    view.zoomTo(100)
    // a real summary read at this zoom: no sequence, just per-species runs
    display.setByteEstimate({ bytes: 60_000, viewport: display.gateViewport! })
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
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // Zoom on its own is not a verdict. It used to be — the stored bytes were
  // scaled by `visibleBp`, so halving the span halved the estimate whatever the
  // index would really have charged. The banner now waits for the next
  // measurement, which is the point.
  it('does not release on zoom alone, without a fresh measurement', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.estimatedFetchBytes).toBe(over(display))
    expect(display.regionTooLarge).toBe(true)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
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
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // Force-load exempts the track outright rather than raising a ceiling past
  // some number, which is what keeps it working after the view has moved and a
  // re-measure has come back larger. The per-axis ceiling system this replaced
  // shipped exactly that bug on LD.
  it('force-load clears the banner even after a bigger re-measure', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(400)
    display.setByteEstimate({
      bytes: over(display) * 2,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats until the
  // while-gated re-measure landed — a banner quoting another chromosome's cost.
  it('clears the cached estimate on region navigation so it cannot wedge', () => {
    const { display, view } = createMafTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: over(display),
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})

// The pre-flight is a real download — index chunks, re-read on every viewport
// change for BAM/CRAM/tabix — so it is exactly as worth cancelling as the fetch
// it precedes, and exactly as worth naming while the user waits on it. It went
// unwired because `byteGateBlocksFetch` narrowed its parameter to
// `{ isStale }`, which silently dropped the rest of the FetchContext both
// callers were already handing it. Pinned here rather than left to the type:
// re-narrowing that parameter still compiles at every call site.
describe('byte-estimate pre-flight forwarding', () => {
  it('forwards the fetch stop token and status callback to the RPC', async () => {
    const { display, view, mockRpcCall } = createMafTestEnvironment(
      {},
    ).createDisplay()
    view.zoomTo(100)
    mockRpcCall.mockResolvedValue(1000)
    const statusCallback = jest.fn()

    await display.byteGateBlocksFetch(
      [{ refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }],
      makeFetchContext(display, {
        stopToken: 'tok',
        isStale: () => false,
        statusCallback,
      }),
    )

    const call = mockRpcCall.mock.calls.find(
      c => c[1] === 'CoreGetRegionByteEstimate',
    )
    expect(call).toBeDefined()
    expect(call![2]).toMatchObject({
      stopToken: 'tok',
      statusCallback,
    })
  })

  it('names the phase it is making the user wait through', async () => {
    const { display, view, mockRpcCall } = createMafTestEnvironment(
      {},
    ).createDisplay()
    view.zoomTo(100)
    mockRpcCall.mockResolvedValue(1000)
    const seen: unknown[] = []

    await display.byteGateBlocksFetch(
      [{ refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }],
      makeFetchContext(display, {
        stopToken: 'tok',
        isStale: () => false,
        statusCallback: s => {
          seen.push(s)
        },
      }),
    )

    // the label while it runs, then the clear that every phase helper ends with
    expect(seen).toEqual(['Estimating size', ''])
  })

  // The pre-flight's half of "a fetch that measured nothing writes nothing".
  // Canvas's half is pinned as "keeps a good estimate when a batch measured no
  // bytes" in LinearMultiRowFeatureDisplay/derivedRegionTooLarge.test.ts; this
  // path published `bytes: undefined` instead until 2026-08, which wiped the
  // last real measurement and reset the two-point `zoomIneffective` comparison
  // with it. `ByteEstimate.bytes` being a number is what makes re-introducing
  // that a type error, but the SKIP itself is a call-site decision — coercing an
  // unmeasurable answer to 0 would compile and would gate nothing forever.
  it('keeps a good estimate when the adapter answers unmeasurable', async () => {
    const { display, view, mockRpcCall } = createMafTestEnvironment(
      {},
    ).createDisplay()
    view.zoomTo(100)
    const ctx = makeFetchContext(display, {
      stopToken: 'tok',
      isStale: () => false,
      statusCallback: () => {},
    })

    const bytes = over(display)
    mockRpcCall.mockResolvedValue(bytes)
    await display.byteGateBlocksFetch(
      [{ refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }],
      ctx,
    )
    expect(display.regionTooLarge).toBe(true)

    // an adapter quoting no index estimate: "unmeasurable", not "zero bytes"
    mockRpcCall.mockResolvedValue(undefined)
    await display.byteGateBlocksFetch(
      [{ refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }],
      ctx,
    )

    expect(display.byteEstimate?.bytes).toBe(bytes)
    expect(display.regionTooLarge).toBe(true)
  })

  // ...and it still records that the gate asked, so a blocked display keeps
  // running one fetch per settled viewport instead of wedging on a stamp it
  // never wrote. The stamp and the estimate are separate commits for exactly
  // this case.
  it('still stamps the viewport it asked about', async () => {
    const { display, view, mockRpcCall } = createMafTestEnvironment(
      {},
    ).createDisplay()
    view.zoomTo(100)
    mockRpcCall.mockResolvedValue(undefined)

    await display.byteGateBlocksFetch(
      [{ refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' }],
      makeFetchContext(display, {
        stopToken: 'tok',
        isStale: () => false,
        statusCallback: () => {},
      }),
    )

    expect(display.byteEstimate).toBeUndefined()
    expect(display.gateMeasurementStale).toBe(false)
  })
})
