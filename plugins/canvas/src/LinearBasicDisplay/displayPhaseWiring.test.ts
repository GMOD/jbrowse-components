import { createTestEnvironment } from './testEnv.ts'

// `computeLoadingTerm` (render-core) is pinned as a pure function by
// displayPhase.test.ts, including an exhaustive parity sweep against the two
// expressions it replaced. What that can't see is the *wiring* — whether
// MultiRegionDisplayMixin passes the right getters into it. These drive a real
// per-region display in a real view and assert the phase it actually publishes.
//
// LinearBasicDisplay is the stand-in for the whole per-region family: the term
// lives on the mixin, so any composer would do, and this one already has a
// display-instantiation harness.
const { createDisplay } = createTestEnvironment()

test('loading before the first paint', () => {
  const { display } = createDisplay()
  expect(display.canvasDrawn).toBe(false)
  expect(display.displayPhase).toBe('loading')
})

test('ready once painted with the viewport covered', () => {
  const { display, view } = createDisplay()
  display.setLoadedRegion(0, view.displayedRegions[0]!)
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')
})

test('loading again when the viewport leaves loaded data', () => {
  const { display, view } = createDisplay()
  display.setLoadedRegion(0, {
    ...view.displayedRegions[0]!,
    end: 100,
  })
  display.markCanvasDrawn()
  // the viewport spans 10kb, only the first 100bp is loaded
  expect(display.viewportWithinLoadedData).toBe(false)
  expect(display.displayPhase).toBe('loading')
})

// The reason the cancel term must not be spelled by hand. `cancelFetchByUser`
// drops the stop token synchronously, so `isLoading` is already false here; if
// the phase fell to `ready` the loading overlay — which is what carries the
// Retry button after a cancel — would unmount, leaving the display stopped and
// empty with nothing to click and nothing to restart it. See
// agent-docs/reference/DISPLAYCHROME.md, "The retry affordance is a contract".
test('a user cancel keeps the overlay up even though isLoading is false', () => {
  const { display, view } = createDisplay()
  display.setLoadedRegion(0, view.displayedRegions[0]!)
  display.markCanvasDrawn()
  expect(display.displayPhase).toBe('ready')

  display.cancelFetchByUser()
  expect(display.isLoading).toBe(false)
  expect(display.fetchCanceled).toBe(true)
  expect(display.displayPhase).toBe('loading')
})

// The terminals still outrank the loading term after the hoist.
test('an error outranks loading', () => {
  const { display } = createDisplay()
  expect(display.displayPhase).toBe('loading')
  display.setError(new Error('boom'))
  expect(display.displayPhase).toBe('error')
})

test('renderError outranks everything', () => {
  const { display } = createDisplay()
  display.setError(new Error('boom'))
  display.setRenderError(new Error('gpu'))
  expect(display.displayPhase).toBe('renderError')
})
