import { types } from '@jbrowse/mobx-state-tree'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'
import { act, render } from '@testing-library/react'

import DisplayChrome from './DisplayChrome.tsx'

import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

// Direct, fast guard for the commit rules documented in DisplayChrome.tsx (and
// displayPhase.ts): the terminal banners must be literal `if (...) return`s, and
// the loading term must stay a lazy thunk. These tests assert the
// banner/overlay/canvas subtrees actually COMMIT to the DOM (via Testing Library
// `findBy*`), not merely that the right element was returned — the historical
// bug was a returned-but-never-committed subtree.
//
// Negative-control status (both mutations verified to fail this file, then
// reverted — NOT left in production):
//
//   - Rule 1 (rewrite the two `if (...) return`s as a single ternary `return`):
//     deterministically fails the two RE-RENDER-driven cases — the
//     `tooLarge -> ready` transition and the `canvasDrawn` `-done` flip. With
//     the ternary the mobx-react observer still RE-RENDERS (its body runs and
//     returns the updated element) but React never COMMITS the new subtree, so
//     `chrome-done` / `probe-canvas` never reach the DOM. This reproduces the
//     production hazard at the unit level — crucially on the mobx-driven
//     re-render, not on initial mount (the first-paint banner cases still commit
//     under the ternary, which is why only the transition/flip cases bite).
//
//   - Rule 1b (evaluate the `loading` term eagerly so the observer subscribes to
//     the churning loading observable while a terminal flag is set): fails
//     `terminal banner survives loading-condition churn` — the churn re-fires
//     the observer during `tooLarge` and the banner drops out of the DOM. With
//     the production lazy thunk the loading observable isn't read during a
//     terminal state, so the churn is inert and the banner stays committed.
//
// products/jbrowse-web/src/tests/StatsEstimation.test.tsx remains the heavier
// end-to-end guard (real force-load path); this file is the fast co-located one.

interface StubBackend {
  dispose(): void
}

// Minimal real MST model satisfying `ChromeModel & RenderLifecycleModel`.
// `displayPhase` is computed through the production `computeDisplayPhase` with a
// lazy loading thunk, so the model mirrors the real precedence/laziness contract
// rather than hard-coding a phase string.
const TestChromeModel = types
  .model('TestChromeModel', {
    height: 100,
    regionTooLarge: false,
    regionTooLargeReason: '',
    canvasDrawn: false,
    statusMessage: types.maybe(types.string),
  })
  .volatile(
    (): {
      error: unknown
      renderError: unknown
      loadingCondition: boolean
    } => ({
      error: undefined,
      renderError: undefined,
      loadingCondition: false,
    }),
  )
  .views(self => ({
    get displayPhase(): DisplayPhase {
      return computeDisplayPhase(
        {
          renderError: self.renderError,
          regionTooLarge: self.regionTooLarge,
          error: self.error,
        },
        () => self.loadingCondition,
      )
    },
  }))
  .actions(self => ({
    reload() {},
    forceLoad() {},
    renderNow() {},
    startRenderingBackend(_backend: StubBackend) {},
    stopRenderingBackend() {},
    setRenderError(error: unknown) {
      self.renderError = error
    },
    setError(error: unknown) {
      self.error = error
    },
    setRegionTooLarge(value: boolean, reason = '') {
      self.regionTooLarge = value
      self.regionTooLargeReason = reason
    },
    setCanvasDrawn(value: boolean) {
      self.canvasDrawn = value
    },
    setLoadingCondition(value: boolean) {
      self.loadingCondition = value
    },
  }))

function renderChrome(
  model: Instance<typeof TestChromeModel>,
  testid?: string,
) {
  return render(
    <DisplayChrome
      model={model}
      factory={() => Promise.resolve<StubBackend>({ dispose() {} })}
      testid={testid}
    >
      {({ canvasRef }) => <canvas data-testid="probe-canvas" ref={canvasRef} />}
    </DisplayChrome>,
  )
}

test('tooLarge phase commits TooLargeMessage and replaces the canvas', async () => {
  const model = TestChromeModel.create({})
  model.setRegionTooLarge(true, 'Requested too much data')
  const { findByText, queryByTestId } = renderChrome(model)

  await findByText(/Requested too much data/)
  // subtree replacement: the canvas children are not rendered
  expect(queryByTestId('probe-canvas')).toBeNull()
})

test('renderError phase commits DisplayRenderErrorOverlay and replaces the canvas', async () => {
  const model = TestChromeModel.create({})
  model.setRenderError(new Error('boom-render-error'))
  const { findByText, findByTestId, queryByTestId } = renderChrome(model)

  await findByText(/boom-render-error/)
  await findByTestId('reload_button') // retry affordance committed
  expect(queryByTestId('probe-canvas')).toBeNull()
})

test('error phase overlays DisplayErrorBar while keeping the canvas mounted', async () => {
  const model = TestChromeModel.create({})
  model.setError(new Error('boom-error-bar'))
  const { findByText, findByTestId } = renderChrome(model)

  await findByTestId('probe-canvas') // overlay, not replacement
  await findByText(/boom-error-bar/)
})

test('loading phase overlays the loading scrim while keeping the canvas mounted', async () => {
  const model = TestChromeModel.create({})
  model.setLoadingCondition(true)
  const { findByTestId } = renderChrome(model)

  await findByTestId('probe-canvas')
  await findByTestId('loading-overlay')
})

test('ready phase shows the canvas with no banners; canvasDrawn toggles the -done testid', async () => {
  const model = TestChromeModel.create({})
  const { findByTestId, getByTestId, queryByTestId } = renderChrome(
    model,
    'chrome',
  )

  await findByTestId('probe-canvas')
  expect(queryByTestId('loading-overlay')).toBeNull()
  // canvasDrawn:false -> bare base testid
  expect(getByTestId('chrome')).toBeTruthy()

  act(() => {
    model.setCanvasDrawn(true)
  })

  // canvasDrawn:true -> `-done` suffix appended by the chrome
  await findByTestId('chrome-done')
  expect(queryByTestId('chrome')).toBeNull()
})

test('terminal banner survives loading-condition churn (lazy-thunk guard)', async () => {
  const model = TestChromeModel.create({})
  model.setRegionTooLarge(true, 'Requested too much data')
  const { findByText, queryByTestId } = renderChrome(model)
  await findByText(/Requested too much data/)

  // Churn the loading observable while the terminal banner is up. With the lazy
  // `computeDisplayPhase` thunk this observable is never read during `tooLarge`,
  // so the observer doesn't even re-fire and the banner stays committed.
  // Evaluating the loading term eagerly (Rule 1b violation) would subscribe to
  // this churn during the terminal state and drop the banner from the DOM.
  act(() => {
    for (let i = 0; i < 5; i++) {
      model.setLoadingCondition(i % 2 === 0)
    }
  })

  await findByText(/Requested too much data/)
  expect(queryByTestId('probe-canvas')).toBeNull()
})

test('tooLarge -> ready transition unmounts the banner and mounts the canvas', async () => {
  const model = TestChromeModel.create({})
  model.setRegionTooLarge(true, 'Requested too much data')
  const { findByText, findByTestId, queryByText } = renderChrome(model)

  await findByText(/Requested too much data/)

  act(() => {
    model.setRegionTooLarge(false)
    model.setCanvasDrawn(true)
  })

  await findByTestId('probe-canvas')
  expect(queryByText(/Requested too much data/)).toBeNull()
})
