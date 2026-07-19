import { types } from '@jbrowse/mobx-state-tree'

import GlobalDataDisplayMixin from './GlobalDataDisplayMixin.ts'

// A minimal global display that exposes the dataLoaded hook, mirroring how
// LinearHicDisplay reports "the contact matrix has been fetched". The fetch
// trigger is a debounced autorun, so at SVG-export time `isLoading` is still
// false with no data yet — svgReady must gate on dataLoaded, not on
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
      get dataLoaded() {
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
  expect(model.dataLoaded).toBe(false)
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
  expect(model.dataLoaded).toBe(false)
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

test('displayPhase is not loading pre-paint when wantsData is false', () => {
  const model = types
    .compose(
      'TestNoDataDisplay',
      GlobalDataDisplayMixin(),
      types.model({ type: types.literal('TestNoDataDisplay') }),
    )
    .views(() => ({
      get wantsData() {
        return false
      },
    }))
    .create({ type: 'TestNoDataDisplay' })
  // A display that renders nothing on purpose never paints a canvas, so the
  // pre-paint scrim must not sit permanently over it.
  expect(model.canvasDrawn).toBe(false)
  expect(model.displayPhase).toBe('ready')
})
