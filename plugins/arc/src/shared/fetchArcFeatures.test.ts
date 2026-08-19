import { createTestEnvironment } from './testEnv.ts'

// Arc's regionTooLarge is DERIVED (byte-only), identical to the LD pattern
// (ArcFetchModel), so it is exercised the same way: drive setByteEstimate
// synchronously — before the async afterAttach installs its autoruns — and read
// the derived getter. This is the de-specialization the migration achieved:
// there is no imperative setRegionTooLarge and no "don't early-return" hack.
describe('arc derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
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
    view.zoomTo(2000)
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

    display.setByteEstimate({
      bytes: 400_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: the estimate survives a viewport shift', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)

    // zoom out: a fresh measurement comes back bigger, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(8000)
    expect(display.regionTooLarge).toBe(true)
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
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
})

// The arcFetchPhases flow (density probe → commit → derived gate → feature
// download) mirrors LD's, and both run through the shared
// installGlobalFetchAutorun; it isn't unit-tested in isolation here because the
// direct call races the async afterAttach autoruns (which clear the estimate on
// install). Browser tests cover the end-to-end path via the arc-display-done
// testid.

// `displayPhase` moved from BaseDisplayComponent onto the model so the component
// can't disagree with it. Pinned here because the terminal flags reach
// computeDisplayPhase as explicit fields: spreading the MST node instead drops
// them (view getters are non-enumerable), which reads as a permanently
// non-terminal display rather than as an error.
describe('arc displayPhase', () => {
  it('ranks tooLarge above error above loading', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    // before the debounced fetch autorun starts, isLoading is false — the
    // pre-first-paint window is the component's `drawn` flag, not a phase
    expect(display.displayPhase).toBe('ready')

    display.setError(new Error('boom'))
    expect(display.displayPhase).toBe('error')

    view.zoomTo(2000)
    display.setByteEstimate({
      bytes: 1_500_000,
      viewport: display.gateViewport!,
    })
    expect(display.regionTooLarge).toBe(true)
    expect(display.displayPhase).toBe('tooLarge')
  })

  it('reaches ready once features land with no fetch in flight', async () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(50)
    await settle()
    expect(display.features).toBeDefined()
    expect(display.displayPhase).toBe('ready')
  })
})

// Arc's fetch trigger gates on `!dataCurrent`, which goes false the moment a
// fetch commits. That is the shape that breaks a naive reload: the skeleton
// autorun stops re-reading `reloadCounter` once it settles into "nothing to
// fetch", so bumping the counter can't wake it, and the signature still matches
// so `prepare` would decline anyway. Covers both halves of the fix —
// unconditional trigger reads in installGlobalFetchAutorun, and ArcFetchModel's
// reload() dropping loadedRegionSignature.
describe('arc reload', () => {
  it('refetches after a successful load', async () => {
    const { display, view, mockRpcCall } =
      createTestEnvironment().createDisplay()
    // zoom in under the byte cap so the first fetch actually commits
    view.zoomTo(50)
    await settle()

    const featureFetches = () =>
      mockRpcCall.mock.calls.filter(c => c[1] === 'CoreGetFeatures').length
    expect(display.dataCurrent).toBe(true)
    expect(featureFetches()).toBe(1)

    display.reload()
    await settle()
    expect(featureFetches()).toBe(2)
  })
})

// the fetch autorun is debounced 1s, so give it room past that
async function settle() {
  for (let i = 0; i < 80; i++) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
