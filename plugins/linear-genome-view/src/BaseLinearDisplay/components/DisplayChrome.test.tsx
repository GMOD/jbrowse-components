import { types } from '@jbrowse/mobx-state-tree'
import { computeDisplayPhase } from '@jbrowse/render-core/displayPhase'
import { act, render } from '@testing-library/react'

import DisplayChrome from './DisplayChrome.tsx'

import type { Instance } from '@jbrowse/mobx-state-tree'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

// Fast guard that the banner/overlay/canvas subtrees actually COMMIT to the DOM
// (via Testing Library `findBy*`) across mobx-driven transitions — the historical
// bug was a returned-but-never-committed subtree.
//
// That bug was `babel-plugin-react-compiler` memoizing a MobX read on stable
// identity; `DisplayChromeInner` now carries `'use no memo'`, so it is no longer
// compiled and the ternary-vs-early-`return` sensitivity is gone (see
// `agent-docs/reference/COMPILER_TERNARY_FINDING.md`). These tests still guard the runtime
// commit behavior, plus rule 1b: the `displayPhase` loading term must stay a lazy
// thunk so the observer doesn't track the churning `visibleRegions`/`loadedRegions`
// set while a terminal banner is up (`terminal banner survives loading-condition
// churn`).
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

// The distinction the screenshot generator depends on: `-done` is first paint,
// `data-display-phase` is doneness. A display that has painted an empty canvas
// while its fetch is still running reports BOTH `-done` and `loading`, so a
// capture gated on the testid alone lands on a half-loaded frame.
test('data-display-phase reports loading even once canvasDrawn has flipped', async () => {
  const model = TestChromeModel.create({})
  model.setLoadingCondition(true)
  model.setCanvasDrawn(true)
  const { findByTestId } = renderChrome(model, 'chrome')

  const el = await findByTestId('chrome-done')
  expect(el.getAttribute('data-display-phase')).toBe('loading')

  act(() => {
    model.setLoadingCondition(false)
  })

  expect(el.getAttribute('data-display-phase')).toBe('ready')
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
