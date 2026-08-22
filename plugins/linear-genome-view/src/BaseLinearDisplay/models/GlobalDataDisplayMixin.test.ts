import { types } from '@jbrowse/mobx-state-tree'

import GlobalDataDisplayMixin from './GlobalDataDisplayMixin.ts'

import type { IAnyModelType, Instance } from '@jbrowse/mobx-state-tree'

// `isViewModel` (core/util/types) duck-types on width + setWidth, which is all
// `getContainingView` needs to reach this from the display it holds — and the
// foundation's `lgv` is not optional any more: `viewportEmpty` asks the view
// whether any content block is on screen, so the phase, the export gate and
// `painted` all read through it.
function hostView(Display: IAnyModelType, snapshot: Record<string, unknown>) {
  return types
    .model('TestView', { display: Display })
    .volatile(() => ({
      width: 800,
      initialized: true,
      hasVisibleContent: true,
    }))
    .actions(self => ({
      setWidth(n: number) {
        self.width = n
      },
      setHasVisibleContent(v: boolean) {
        self.hasVisibleContent = v
      },
    }))
    .create({ display: snapshot })
}

// A minimal global display that exposes the dataCurrent hook, mirroring how
// LinearHicDisplay reports "the contact matrix has been fetched". The fetch
// trigger is a debounced autorun, so at SVG-export time `isLoading` is still
// false with no data yet — svgReady must gate on dataCurrent, not on
// "not currently fetching", or the export captures an empty render.
function testModel() {
  const Display = types
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
  // annotated, because `hostView` erases the display type to hold one non-generic
  // view model — the same reason the shared harness annotates `displays[0]`: an
  // inferred `any` would make a getter the model does not have compile
  const model: Instance<typeof Display> = hostView(Display, {
    type: 'TestGlobalDisplay',
  }).display
  return model
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
  const Display = types
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
  const model: Instance<typeof Display> = hostView(Display, {
    type: 'TestNoCanvasDisplay',
  }).display
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
  const model: Instance<typeof Suppressed> = hostView(Suppressed, {
    type: 'TestSuppressedDisplay',
  }).display

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

// A viewport holding no content block — every displayed region elided under
// `showAllRegions` on a scaffold-level assembly. `prepare` declines there, so
// nothing is fetched,
// nothing is committed and nothing is painted: without the term this display
// sat under the scrim and never resolved `svgReady`, which is an unbounded
// `when` in `awaitSvgReady` and hangs the whole view's SVG export.
describe('an empty viewport is a resting state, so it is terminal', () => {
  const Display = types
    .compose(
      'TestEmptyViewportDisplay',
      GlobalDataDisplayMixin(),
      types.model({ type: types.literal('TestEmptyViewportDisplay') }),
    )
    .views(() => ({
      get dataCurrent() {
        return false
      },
    }))

  function offContent() {
    const view = hostView(Display, { type: 'TestEmptyViewportDisplay' })
    view.setHasVisibleContent(false)
    const model: Instance<typeof Display> = view.display
    return model
  }

  test('displayPhase is ready, not a permanent scrim', () => {
    const model = offContent()
    expect(model.viewportEmpty).toBe(true)
    expect(model.canvasDrawn).toBe(false)
    expect(model.displayPhase).toBe('ready')
  })

  test('svgReady resolves with no data', () => {
    expect(offContent().svgReady).toBe(true)
  })

  test('painted reports finished', () => {
    expect(offContent().painted).toBe(true)
  })

  test('an error still outranks it', () => {
    const model = offContent()
    model.setError(new Error('boom'))
    expect(model.displayPhase).toBe('error')
  })
})
