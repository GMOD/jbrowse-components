import { getMembers } from '@jbrowse/mobx-state-tree'

import { createTestEnvironment } from './testEnv.ts'

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport. These lock in the behavior the imperative path got
// wrong — a banner that stuck on zoom-in (the reported bug), and that would
// flicker on pan.
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
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
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
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
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    expect(display.estimatedFetchBytes).toBe(1_500_000)
    expect(display.regionTooLarge).toBe(true)
    // ...and the autorun knows to go and ask again
    expect(display.gateMeasurementStale).toBe(true)

    display.setByteEstimate({ bytes: 700_000, viewport: display.gateViewport! })
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // pan (same zoom) keeps it too large; the estimate is not cleared
    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
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
    display.setByteEstimate({
      bytes: 3_000_000,
      viewport: display.gateViewport!,
    })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // The release mechanism itself, driven through the fetch rather than through
  // setByteEstimate: `installGlobalFetchAutorun` skips only on `regionTooLarge
  // && !gateMeasurementStale`, so a blocked display still runs one fetch per
  // settled viewport and that fetch's pre-flight is what re-measures. This
  // pins that `performLDFetch` does not restate the too-large skip itself —
  // when it did, the gate RPC was never reached and no amount of zooming could
  // clear the banner (only force-load or chromosome nav could).
  it('still measures while the banner holds, so a fresh estimate releases it', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    // let afterAttach's dynamic import resolve and install its autoruns
    await new Promise(res => setTimeout(res, 0))

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom in: the stored estimate is now about a viewport the user has left
    view.zoomTo(10)
    expect(display.gateMeasurementStale).toBe(true)
    expect(display.regionTooLarge).toBe(true)

    mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
      method === 'CoreGetRegionByteEstimate' ? 700_000 : null,
    )
    // counted from here, since the autorun installed above has already run one
    // fetch of its own against the default (undefined-returning) mock
    mockRpcCall.mockClear()
    await display.performLDFetch()

    expect(
      mockRpcCall.mock.calls.filter(c => c[1] === 'CoreGetRegionByteEstimate'),
    ).toHaveLength(1)
    expect(display.estimatedFetchBytes).toBe(700_000)
    expect(display.regionTooLarge).toBe(false)
  })

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats and, because the
  // fetch autorun gates on !regionTooLarge, wedge the banner permanently.
  it('clears the cached estimate on region navigation so it cannot wedge', async () => {
    const { display, view } = createTestEnvironment().createDisplay()
    // let afterAttach's dynamic import resolve and install its autoruns
    await new Promise(res => setTimeout(res, 0))

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
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
