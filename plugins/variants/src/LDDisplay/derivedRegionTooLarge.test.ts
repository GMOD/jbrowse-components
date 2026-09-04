import { stageByteEstimate } from '@jbrowse/display-test-utils'
import { getMembers } from '@jbrowse/mobx-state-tree'

import { awaitFetch, createTestEnvironment } from './testEnv.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport. These lock in the behavior the imperative path got
// wrong — a banner that stuck on zoom-in (the reported bug), and that would
// flicker on pan.
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer.
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

describe('LD derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    stageByteEstimate(display, 1_500_000)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // Zoom is not a verdict: the stored figure is what the index quoted for the
  // viewport it was taken at, not a rate to scale by span. The fetch autorun
  // re-runs once per settled viewport while the banner holds, and the
  // measurement it takes is what releases it.
  it('holds until a fresh measurement releases it, not on zoom alone', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    expect(display.estimatedFetchBytes).toBe(1_500_000)
    expect(display.regionTooLarge).toBe(true)
    // ...and the autorun knows to go and ask again
    expect(display.gateMeasurementStale).toBe(true)

    stageByteEstimate(display, 700_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    // pan (same zoom) keeps it too large; the estimate is not cleared
    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    // zoom out: the scaled estimate grows past the raw captured bytes, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // The estimate carries bytes and nothing else: the byte *budget* is a
  // main-thread config read (`gateByteLimit`), so this display, whose track
  // declares no adapter limit, gates on the 1MB baseLinearDisplay floor. The
  // adapter-tier precedence is pinned by `resolveByteLimit`'s unit test and by
  // the canvas displays, whose harness gives the track a real adapter config.
  it('gates on the display config when the adapter declares no limit', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    expect(display.adapterFetchSizeLimit).toBeUndefined()
    stageByteEstimate(display, 3_000_000)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // The release mechanism itself, driven through the installed fetch rather
  // than through a staged estimate: `installGlobalFetchAutorun` skips only on
  // `regionTooLarge && !gateMeasurementStale`, so a blocked display still runs
  // one fetch per settled viewport and that fetch's pre-flight is what
  // re-measures. What these pin is the phases and the commit — that
  // `ldFetchPhases` does not restate the too-large skip itself (when it did,
  // the gate RPC was never reached and no amount of zooming could clear the
  // banner: only force-load or chromosome nav could), and that the measurement
  // rides in the fetch. The gate terms themselves are
  // `installGlobalFetchAutorun.test.ts`'s.
  it('still measures while the banner holds, so a fresh estimate releases it', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    // let afterAttach's dynamic import resolve and install its autoruns
    await new Promise(res => setTimeout(res, 0))

    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    // zoom in: the stored estimate is now about a viewport the user has left.
    // Still above AUTO_FORCE_LOAD_BP, so the sub-floor budget tier isn't what
    // holds or releases the banner here — the measurement is.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.gateMeasurementStale).toBe(true)
    expect(display.regionTooLarge).toBe(true)

    mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
      method === 'RenderLDData' ? { bytes: 700_000 } : null,
    )
    // counted from here, since the autorun installed above has already run one
    // fetch of its own against the default (undefined-returning) mock
    mockRpcCall.mockClear()
    await awaitFetch(mockRpcCall, display)

    // one call, not two: the measurement rides in the fetch that would have
    // followed it
    const calls = mockRpcCall.mock.calls.filter(c => c[1] === 'RenderLDData')
    expect(calls).toHaveLength(1)
    expect(calls[0]![2].byteLimit).toBe(display.gateByteLimit)
    expect(display.estimatedFetchBytes).toBe(700_000)
    expect(display.regionTooLarge).toBe(false)
  })

  // A return to a viewport this display already HOLDS data for, so the
  // signature compare is satisfied by that earlier commit — and the fetch still
  // has to reach the RPC, because the banner is hiding that data and the
  // measurement is the only thing that releases it. What this pins is the LD
  // side of it: one RPC, carrying the byte limit, and a commit that clears both
  // the banner and the stale-measurement flag. The PRECEDENCE that lets the run
  // through is the installed autorun's `loadedKey`, which reads as absent
  // while `regionTooLarge` holds — `installGlobalFetchAutorun.test.ts`'s
  // 'fetches a viewport whose data it still holds, and only once' pins that on
  // the skeleton. Before the precedence existed this shipped as a display stuck
  // at `tooLarge` with zero RPCs and no way out but force-load or chromosome
  // nav.
  it('fetches at a viewport whose data it still holds', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    await new Promise(res => setTimeout(res, 0))

    view.zoomTo(50)
    const loadedViewport = display.currentFetchKey
    mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
      method === 'RenderLDData' ? { bytes: 100_000, ldData: [] } : null,
    )
    await awaitFetch(mockRpcCall, display)
    expect(display.dataCurrent).toBe(true)

    // out to a viewport the gate refuses
    view.zoomTo(100)
    mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
      method === 'RenderLDData'
        ? { regionTooLarge: true, bytes: 6_000_000 }
        : null,
    )
    await awaitFetch(mockRpcCall, display)
    expect(display.regionTooLarge).toBe(true)

    // back to the one whose data is still in hand: the banner holds, the
    // measurement behind it is about the viewport just left, and the freshness
    // gate would answer "nothing owed"
    view.zoomTo(50)
    expect(display.currentFetchKey).toBe(loadedViewport)
    expect(display.dataCurrent).toBe(true)
    expect(display.regionTooLarge).toBe(true)
    expect(display.gateMeasurementStale).toBe(true)

    mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
      method === 'RenderLDData' ? { bytes: 100_000, ldData: [] } : null,
    )
    mockRpcCall.mockClear()
    await awaitFetch(mockRpcCall, display)

    // exactly one, and it released the banner
    expect(
      mockRpcCall.mock.calls.filter(c => c[1] === 'RenderLDData'),
    ).toHaveLength(1)
    expect(display.regionTooLarge).toBe(false)
    expect(display.gateMeasurementStale).toBe(false)
  })

  // One RPC carries the whole region set, and the worker measures each region
  // separately against the same per-region budget (`measureRegionBytes`) — so
  // LD reads the budget the way every other display does: what ONE region may
  // cost. One region over refuses the set, because there is one payload
  // covering all of them, and the largest measurement comes back with the
  // refusal so the banner can quote it.
  it('refuses the whole set on one over-budget region, quoting its bytes', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    await new Promise(res => setTimeout(res, 0))
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 100_000, refName: 'ctgA' },
      { assemblyName: 'volvox', start: 0, end: 100_000, refName: 'ctgB' },
    ])
    view.moveTo({ index: 0, offset: 0 }, { index: 1, offset: 100_000 })

    mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
      method === 'RenderLDData'
        ? { regionTooLarge: true, bytes: 6_000_000 }
        : null,
    )
    mockRpcCall.mockClear()
    await awaitFetch(mockRpcCall, display)

    const calls = mockRpcCall.mock.calls.filter(c => c[1] === 'RenderLDData')
    expect(calls).toHaveLength(1)
    // every visible region in that one call
    expect(
      (calls[0]![2] as { regions: { refName: string }[] }).regions.map(
        r => r.refName,
      ),
    ).toEqual(['ctgA', 'ctgB'])
    expect(display.estimatedFetchBytes).toBe(6_000_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // `RegionTooLargeMixin`'s own afterAttach drops the cached estimate on
  // chromosome navigation. Without it, a previous region's estimate would gate
  // the new region against the wrong stats and, because the fetch autorun skips
  // a viewport whose refusal it has already measured, wedge the banner
  // permanently.
  it('clears the cached estimate on region navigation so it cannot wedge', async () => {
    const { display, view } = createTestEnvironment().createDisplay()
    // let afterAttach's dynamic import resolve and install its autoruns
    await new Promise(res => setTimeout(res, 0))

    view.zoomTo(100)
    stageByteEstimate(display, 1_500_000)
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})
