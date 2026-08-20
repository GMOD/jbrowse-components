import { createRpcTestEnvironment as createTestEnvironment } from './testUtils.ts'

// Mark every buffered region loaded and the canvas painted — the state the
// display reaches after a successful fetch.
function simulateLoaded(
  view: ReturnType<
    ReturnType<typeof createTestEnvironment>['createDisplay']
  >['view'],
  display: ReturnType<
    ReturnType<typeof createTestEnvironment>['createDisplay']
  >['display'],
) {
  for (const b of view.bufferedVisibleRegions) {
    display.setLoadedRegion(b.displayedRegionIndex, b.region)
  }
  display.markCanvasDrawn()
  // Attaching the display starts a real fetch — the autorun runs on the leading
  // edge — and these tests are about the phase mapping over loaded regions, not
  // about that fetch. `stopActiveFetch` drops it without bumping
  // `fetchGeneration` or setting `fetchCanceled`, so nothing re-triggers and the
  // phase reads off the state the test staged.
  display.stopActiveFetch()
}

// Worker output is absolute genomic uint32, so alignment data stays valid under
// zoom and alignments overrides neither per-region cache hook: on the empty
// `regionFetchKey`, no zoom stales a region it has loaded — see
// ARCHITECTURE.md §"Per-region zoom-staleness". These pin the consequence: a zoom
// that stays inside the fetched buffer must not drop into the loading phase.
// BreakpointSplitView's overlays depend on it — a cleared `rpcDataMap` makes
// every `searchFeatureByID` miss, which is what collapses its connection curves
// onto the track's bottom edge.
describe('alignments zoom does not invalidate loaded data', () => {
  it('stays ready through a small zoom in', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(5)
    view.scrollTo(1000)
    simulateLoaded(view, display)
    expect(display.displayPhase).toBe('ready')

    view.zoomTo(4.5)

    expect(display.loadedRegions.size).toBe(1)
    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.displayPhase).toBe('ready')
  })

  it('stays ready through a zoom out that stays inside the buffer', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(5)
    view.scrollTo(1000)
    simulateLoaded(view, display)

    view.zoomTo(6)

    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.displayPhase).toBe('ready')
  })

  it('goes loading once a zoom out leaves the buffer, but keeps the data', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(5)
    view.scrollTo(1000)
    simulateLoaded(view, display)

    view.zoomTo(20)

    // The overlay curves must survive this: the viewport is stale but the
    // pileup data isn't cleared, so reads are still locatable by id.
    expect(display.viewportWithinLoadedData).toBe(false)
    expect(display.displayPhase).toBe('loading')
    expect(display.loadedRegions.size).toBe(1)
  })
})
