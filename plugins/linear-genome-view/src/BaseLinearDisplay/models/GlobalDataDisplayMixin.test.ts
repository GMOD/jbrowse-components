import { types } from '@jbrowse/mobx-state-tree'

import GlobalDataDisplayMixin from './GlobalDataDisplayMixin.ts'

// A minimal global display that exposes the dataCurrent hook, mirroring how
// LinearHicDisplay reports "the contact matrix has been fetched". The fetch
// trigger is a debounced autorun, so at SVG-export time `isLoading` is still
// false with no data yet — svgReady must gate on dataCurrent, not on
// "not currently fetching", or the export captures an empty render.
function testModel() {
  return types
    .compose(
      'TestGlobalDisplay',
      GlobalDataDisplayMixin(),
      types.model({ type: types.literal('TestGlobalDisplay') }),
    )
    .volatile(() => ({ loaded: false }))
    .views(self => ({
      get dataCurrent() {
        return self.loaded
      },
    }))
    .actions(self => ({
      setLoaded(f: boolean) {
        self.loaded = f
      },
    }))
    .create({ type: 'TestGlobalDisplay' })
}

test('svgReady is false before the initial fetch commits data', () => {
  const model = testModel()
  // No data, no error, not too large: an off-screen export must wait.
  expect(model.dataCurrent).toBe(false)
  expect(model.isLoading).toBe(false)
  expect(model.svgReady).toBe(false)
})

test('svgReady becomes true once data is loaded', () => {
  const model = testModel()
  model.setLoaded(true)
  expect(model.svgReady).toBe(true)
})

test('svgReady is true in the terminal error state with no data', () => {
  const model = testModel()
  model.setError(new Error('boom'))
  expect(model.dataCurrent).toBe(false)
  expect(model.svgReady).toBe(true)
})

test('displayPhase is loading on initial open before the first paint', () => {
  const model = testModel()
  // The fetch trigger is a debounced autorun, so isLoading is still false here,
  // yet nothing has painted (canvasDrawn false). The scrim must show now, not
  // only once runFetch flips isLoading a debounce interval later.
  expect(model.isLoading).toBe(false)
  expect(model.canvasDrawn).toBe(false)
  expect(model.displayPhase).toBe('loading')
})

test('displayPhase leaves loading once the first frame paints', () => {
  const model = testModel()
  model.markCanvasDrawn()
  expect(model.displayPhase).toBe('ready')
})

// The global half of the wiring into the shared `computeLoadingTerm`: a cancel
// must keep the overlay (and its Retry) up even though `cancelFetchByUser`
// clears the stop token synchronously, so `isLoading` already reads false.
test('displayPhase stays loading after a user cancel', () => {
  const model = testModel()
  model.markCanvasDrawn()
  expect(model.displayPhase).toBe('ready')

  model.cancelFetchByUser()
  expect(model.isLoading).toBe(false)
  expect(model.displayPhase).toBe('loading')
})

test('displayPhase is not loading pre-paint when rendersCanvas is false', () => {
  const model = types
    .compose(
      'TestNoCanvasDisplay',
      GlobalDataDisplayMixin(),
      types.model({ type: types.literal('TestNoCanvasDisplay') }),
    )
    .views(() => ({
      get rendersCanvas() {
        return false
      },
    }))
    .create({ type: 'TestNoCanvasDisplay' })
  // A display showing a static non-canvas placeholder never paints a canvas, so
  // the pre-paint scrim must not sit permanently over it.
  expect(model.canvasDrawn).toBe(false)
  expect(model.displayPhase).toBe('ready')
})

// `rendersCanvas: false` drops the pre-paint term ALONE, which is not enough for
// a placeholder: the fetch terms still apply, and `fetchCanceled` is deliberately
// durable. That is `fetchInert`'s job — and this family used to hard-code
// it `false`, so LD (the display that needed it) could express only the half it
// could reach and the "Loading canceled / Retry" chip could park permanently over
// "Enable LD triangle". The hook now lives on FetchMixin, which all three display
// foundations compose.
test('fetchInert silences the scrim over a placeholder, cancel included', () => {
  const Suppressed = types
    .compose(
      'TestSuppressedDisplay',
      GlobalDataDisplayMixin(),
      types.model({ type: types.literal('TestSuppressedDisplay') }),
    )
    .views(() => ({
      get rendersCanvas() {
        return false
      },
      get fetchInert() {
        return true
      },
    }))
  const model = Suppressed.create({ type: 'TestSuppressedDisplay' })

  model.cancelFetchByUser()
  expect(model.fetchCanceled).toBe(true)
  expect(model.displayPhase).toBe('ready')
})

// Same reader-outside-the-display argument as `rendersCanvas`, for the state
// where a display would paint and its fetch failed first. See `paintInert`.
test('painted reports finished once a pre-paint fetch has errored', () => {
  const model = testModel()
  expect(model.painted).toBe(false)

  model.setError(new Error('boom'))
  expect(model.canvasDrawn).toBe(false)
  expect(model.painted).toBe(true)
})
