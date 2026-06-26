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
