import {
  DisplayChromeOverlayProvider,
  plainChromeOverlays,
} from '@jbrowse/display-ui'
import {
  isGpuRenderingDisabled,
  setGpuOverride,
} from '@jbrowse/render-core/gpuDevice'
import { createGpuContextLostError } from '@jbrowse/render-core/useRenderingBackend'
import { act, render } from '@testing-library/react'

import DisplayChrome from './DisplayChrome.tsx'
import DisplayChromeBase from './DisplayChromeBase.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// The toolkit-free overlay set, held to the same contract as the MUI one in
// DisplayChrome.test.tsx and driven off the same model fixture.
//
// Two things are being pinned. The `data-testid` values are a contract four
// test systems key on (jest, browser tests, the screenshot harness,
// jbrowse-img), so an embedder swapping the set keeps those suites runnable --
// and, more immediately, so a rewrite of this file cannot quietly drop one. And
// the terminal/overlay split has to match: renderError and tooLarge REPLACE the
// canvas subtree, error and loading draw over a still-mounted one. A set that
// got that backwards would look fine on a happy path and strand the user on a
// GPU failure.
//
// The two entry points are tested separately because they solve different
// problems: `DisplayChromeBase` takes the set as a prop (weight -- MUI never
// enters the module graph), `DisplayChromeOverlayProvider` overrides it through
// context (reach -- it redirects the stock displays, which import
// `DisplayChrome` directly and so cannot be redirected at the import level).

function renderPlain(
  model: Instance<typeof TestChromeModel>,
  testid = 'probe-display',
) {
  return render(
    <DisplayChromeBase
      model={model}
      factory={stubFactory}
      testid={testid}
      overlays={plainChromeOverlays}
    >
      {({ canvasRef }) => <canvas data-testid="probe-canvas" ref={canvasRef} />}
    </DisplayChromeBase>,
  )
}

test('tooLarge replaces the canvas and keeps a force-load affordance', async () => {
  const model = TestChromeModel.create({})
  model.setRegionTooLarge(true, 'Requested too much data')
  const { findByText, queryByTestId } = renderPlain(model)

  await findByText(/Requested too much data/)
  expect(queryByTestId('probe-canvas')).toBeNull()

  // without this the region is unreachable for the rest of the session
  const button = await findByText(/Force load/)
  expect(button).toBeTruthy()
})

test('renderError replaces the canvas and commits the retry testid', async () => {
  const model = TestChromeModel.create({})
  model.setRenderError(new Error('boom-render-error'))
  const { findByText, findByTestId, queryByTestId } = renderPlain(model)

  await findByText(/boom-render-error/)
  await findByTestId('reload_button')
  expect(queryByTestId('probe-canvas')).toBeNull()
})

test('error draws over a still-mounted canvas', async () => {
  const model = TestChromeModel.create({})
  model.setError(new Error('boom-error-bar'))
  const { findByText, findByTestId } = renderPlain(model)

  await findByTestId('probe-canvas')
  await findByText(/boom-error-bar/)
  await findByTestId('reload_button')
})

// No anti-flash delay in this set, unlike the MUI one, so the scrim is expected
// to be present immediately rather than after a timer.
test('loading draws the scrim over a still-mounted canvas', async () => {
  const model = TestChromeModel.create({})
  model.setLoadingCondition(true)
  const { findByTestId } = renderPlain(model)

  await findByTestId('probe-canvas')
  await findByTestId('loading-overlay')
})

// The cancel/retry affordances are optional on the model, and the base fixture
// deliberately omits them -- a display with no cancelable fetch must get no
// dead Cancel button. This extends the fixture locally to drive the other half,
// rather than adding the actions globally and changing what the MUI suite sees.
const CancelableModel = TestChromeModel.volatile(
  (): { fetchCanceled: boolean } => ({ fetchCanceled: false }),
).actions(self => ({
  cancelFetchByUser() {
    self.fetchCanceled = true
  },
}))

test('a fetch with no cancel action gets no dead Cancel button', async () => {
  const model = TestChromeModel.create({})
  model.setLoadingCondition(true)
  const { findByTestId, queryByTestId } = renderPlain(model)

  await findByTestId('loading-overlay')
  expect(queryByTestId('loading-overlay-cancel')).toBeNull()
})

test('a cancelable fetch offers cancel, and a canceled one offers retry', async () => {
  const model = CancelableModel.create({})
  model.setLoadingCondition(true)
  const { findByTestId, queryByTestId } = renderPlain(model)

  const cancel = await findByTestId('loading-overlay-cancel')
  expect(queryByTestId('loading-overlay-retry')).toBeNull()

  act(() => {
    cancel.click()
  })

  // the scrim stays up but flips to the canceled affordance
  await findByTestId('loading-overlay-retry')
  expect(queryByTestId('loading-overlay-cancel')).toBeNull()
})

test('a status while ready shows the corner chip, not the scrim', async () => {
  const model = TestChromeModel.create({})
  act(() => {
    model.setStatus('Clustering samples', 0.25)
  })
  const { findByTestId, queryByTestId, getByText } = renderPlain(model)

  await findByTestId('progress-chip')
  expect(getByText(/Clustering samples 25%/)).toBeTruthy()
  expect(queryByTestId('loading-overlay')).toBeNull()
})

// The chrome, not the overlay set, owns the testid and the phase attribute.
// Re-asserted here so a replacement set can't be blamed for them and so the
// screenshot harness's signals hold on this path too.
test('the base still owns the testid and data-display-phase', async () => {
  const model = TestChromeModel.create({})
  model.setLoadingCondition(true)
  model.setCanvasDrawn(true)
  const { findByTestId } = renderPlain(model, 'chrome')

  const el = await findByTestId('chrome')
  expect(el.dataset.displayPhase).toBe('loading')

  act(() => {
    model.setLoadingCondition(false)
  })
  expect(el.dataset.displayPhase).toBe('ready')
})

describe('the Canvas2D escape hatch survives the swap', () => {
  afterEach(() => {
    setGpuOverride(null)
  })

  test('a lost context still offers Canvas2D and switches the page to it', async () => {
    const model = TestChromeModel.create({})
    model.setRenderError(createGpuContextLostError())
    const { findByTestId } = renderPlain(model)

    const button = await findByTestId('use_canvas2d_button')
    expect(isGpuRenderingDisabled()).toBe(false)

    act(() => {
      button.click()
    })

    expect(isGpuRenderingDisabled()).toBe(true)
    await findByTestId('probe-canvas')
  })

  test('an unrelated render error offers no Canvas2D switch', async () => {
    const model = TestChromeModel.create({})
    model.setRenderError(new Error('something else went wrong'))
    const { findByTestId, queryByTestId } = renderPlain(model)

    await findByTestId('reload_button')
    expect(queryByTestId('use_canvas2d_button')).toBeNull()
  })
})

describe('DisplayChromeOverlayProvider', () => {
  function renderStock(
    model: Instance<typeof TestChromeModel>,
    node: (chrome: React.ReactNode) => React.ReactNode,
  ) {
    return render(
      node(
        <DisplayChrome
          model={model}
          factory={stubFactory}
          testid="probe-display"
        >
          {({ canvasRef }) => (
            <canvas data-testid="probe-canvas" ref={canvasRef} />
          )}
        </DisplayChrome>,
      ),
    )
  }

  // The whole point of the context seam: this is `DisplayChrome`, the component
  // every stock display imports, rendering someone else's overlays.
  test('redirects DisplayChrome to the provided set', async () => {
    const model = TestChromeModel.create({})
    model.setLoadingCondition(true)
    const { findByTestId } = renderStock(model, chrome => (
      <DisplayChromeOverlayProvider value={plainChromeOverlays}>
        {chrome}
      </DisplayChromeOverlayProvider>
    ))

    const overlay = await findByTestId('loading-overlay')
    // the plain scrim styles itself inline from CSS system colours; the MUI one
    // renders an emotion class instead, so this tells the two sets apart
    expect(overlay.className).toBe('')
  })

  // Defaulting the context to a component set instead of `undefined` would make
  // every display rendered outside a provider silently degrade -- unit tests,
  // SVG export, breakpoint split view -- and the degradation is invisible,
  // because the display still works. This is that guard.
  test('leaves DisplayChrome on the MUI set when no provider is present', async () => {
    const model = TestChromeModel.create({})
    model.setLoadingCondition(true)
    const { findByTestId } = renderStock(model, chrome => chrome)

    const overlay = await findByTestId('loading-overlay')
    expect(overlay.className).not.toBe('')
  })
})
