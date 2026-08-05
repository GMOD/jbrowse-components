import {
  isGpuRenderingDisabled,
  setGpuOverride,
} from '@jbrowse/render-core/gpuDevice'
import { createGpuContextLostError } from '@jbrowse/render-core/useRenderingBackend'
import { act, render, waitFor } from '@testing-library/react'

import DisplayChrome, { DisplayStatusChrome } from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

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

function renderChrome(
  model: Instance<typeof TestChromeModel>,
  testid = 'probe-display',
) {
  return render(
    <DisplayChrome model={model} factory={stubFactory} testid={testid}>
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

// Background work (clustering) reports through the same status channel as a
// fetch, but has no fetch behind it, so the phase stays `ready` and the scrim
// never comes up. The corner chip is what makes it visible.
test('a status set while ready shows the corner chip, not the scrim', async () => {
  const model = TestChromeModel.create({})
  act(() => {
    model.setStatus('Clustering samples', 0.25)
  })
  const { findByTestId, queryByTestId, getByText } = renderChrome(model)

  await findByTestId('progress-chip')
  expect(getByText(/Clustering samples 25%/)).toBeTruthy()
  expect(queryByTestId('loading-overlay')).toBeNull()

  act(() => {
    model.setStatus(undefined, undefined)
  })
  await waitFor(() => {
    expect(queryByTestId('progress-chip')).toBeNull()
  })
})

test('a fetch status shows only the scrim, never both indicators', async () => {
  const model = TestChromeModel.create({})
  act(() => {
    model.setStatus('Downloading', 0.5)
    model.setLoadingCondition(true)
  })
  const { findByTestId, queryByTestId } = renderChrome(model)

  await findByTestId('loading-overlay')
  expect(queryByTestId('progress-chip')).toBeNull()
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

// The GPU-error banner's Canvas2D escape hatch. Scoped to a context loss because
// that is the only render error Canvas2D actually remedies, and it turns the GPU
// off page-wide (the ~16-context cap is a per-page resource), so these tests
// restore the override afterwards.
describe('context-lost Canvas2D escape hatch', () => {
  afterEach(() => {
    setGpuOverride(null)
  })

  test('offers Canvas2D for a lost context and switches the page to it', async () => {
    const model = TestChromeModel.create({})
    model.setRenderError(createGpuContextLostError())
    const { findByTestId } = renderChrome(model)

    const button = await findByTestId('use_canvas2d_button')
    expect(isGpuRenderingDisabled()).toBe(false)

    act(() => {
      button.click()
    })

    expect(isGpuRenderingDisabled()).toBe(true)
    // retry cleared the error, so the canvas is back — now on Canvas2D
    await findByTestId('probe-canvas')
  })

  test('offers no Canvas2D switch for an unrelated render error', async () => {
    const model = TestChromeModel.create({})
    model.setRenderError(new Error('region too large for this GPU'))
    const { findByTestId, queryByTestId } = renderChrome(model)

    await findByTestId('reload_button')
    expect(queryByTestId('use_canvas2d_button')).toBeNull()
  })

  test('offers no Canvas2D switch once the GPU is already off', async () => {
    setGpuOverride('canvas2d')
    const model = TestChromeModel.create({})
    model.setRenderError(createGpuContextLostError())
    const { findByTestId, queryByTestId } = renderChrome(model)

    await findByTestId('reload_button')
    expect(queryByTestId('use_canvas2d_button')).toBeNull()
  })
})

// `DisplayStatusChrome` is the same chrome with the rendering backend peeled
// off, for a display that has none (arc's main-thread SVG). It used to be a
// hand-written copy in the arc plugin, which is how arc ended up as the only
// display with no background-progress chip. These run the copy's former job
// against the shared component, off the same fixture the GPU cases above use —
// so "arc's chrome matches every other display's" is a claim under test rather
// than one maintained by hand.
describe('DisplayStatusChrome (no rendering backend)', () => {
  function renderStatusChrome(
    model: Instance<typeof TestChromeModel>,
    testid = 'probe-display',
  ) {
    // a backend-less display never reaches `renderError`, which is exactly what
    // DisplayStatusPhase encodes — so the phase is passed through unchanged
    const phase = model.displayPhase
    if (phase === 'renderError') {
      throw new Error('unreachable: the fixture sets no renderError here')
    }
    return render(
      <DisplayStatusChrome
        model={model}
        phase={phase}
        drawn={model.canvasDrawn}
        testid={testid}
      >
        <div data-testid="probe-body" />
      </DisplayStatusChrome>,
    )
  }

  test('tooLarge replaces the body, same as the GPU chrome', async () => {
    const model = TestChromeModel.create({})
    model.setRegionTooLarge(true, 'Requested too much data')
    const { findByText, queryByTestId } = renderStatusChrome(model)

    await findByText(/Requested too much data/)
    expect(queryByTestId('probe-body')).toBeNull()
  })

  test('error and loading draw over a still-mounted body', async () => {
    const model = TestChromeModel.create({})
    model.setLoadingCondition(true)
    const { findByTestId, queryByTestId } = renderStatusChrome(model)

    await findByTestId('loading-overlay')
    expect(queryByTestId('probe-body')).toBeTruthy()

    act(() => {
      model.setError(new Error('boom-status-error'))
    })
    await findByTestId('reload_button')
    expect(queryByTestId('probe-body')).toBeTruthy()
  })

  test('owns the -done testid and publishes data-display-phase', async () => {
    const model = TestChromeModel.create({})
    model.setLoadingCondition(true)
    const { findByTestId, rerender } = renderStatusChrome(model, 'status')

    const el = await findByTestId('status')
    expect(el.getAttribute('data-display-phase')).toBe('loading')

    act(() => {
      model.setCanvasDrawn(true)
    })
    rerender(
      <DisplayStatusChrome model={model} phase="loading" drawn testid="status">
        <div data-testid="probe-body" />
      </DisplayStatusChrome>,
    )
    await findByTestId('status-done')
  })

  // the drift this component was extracted to end
  test('shows the background-progress chip while ready', async () => {
    const model = TestChromeModel.create({})
    act(() => {
      model.setStatus('Clustering samples', 0.25)
    })
    const { findByTestId, queryByTestId } = renderStatusChrome(model)

    await findByTestId('progress-chip')
    expect(queryByTestId('loading-overlay')).toBeNull()
  })
})

// A backend re-init needs a canvas element that never held a context: a canvas's
// context kind is permanent, so re-running the HAL ladder on a used element can
// find it committed to a rung the ladder no longer wants (canvasContext.ts).
// This used to be covered only for the `renderError` path — that phase replaces
// the subtree, so the remount came free — while three other paths bump
// `canvasKey` with no `renderError` at all and silently reused the element.
describe('fresh canvas element per re-init', () => {
  test('a browser context restore remounts the canvas without any renderError', async () => {
    const model = TestChromeModel.create({})
    const { findByTestId, getByTestId } = renderChrome(model, 'chrome')
    const first = await findByTestId('probe-canvas')
    const container = getByTestId('chrome')

    // the real path: `webglcontextrestored` bumps canvasKey and deliberately
    // sets no error, since the browser recovered on its own
    act(() => {
      first.dispatchEvent(new Event('webglcontextrestored'))
    })

    await waitFor(() => {
      expect(getByTestId('probe-canvas')).not.toBe(first)
    })
    expect(model.renderError).toBeUndefined()
    // scoped to the body: the chrome container (and with it the loading scrim,
    // whose 250ms anti-flash delay lives in component state) must NOT remount
    expect(getByTestId('chrome')).toBe(container)
  })

  test('an ordinary re-render keeps the live element', async () => {
    const model = TestChromeModel.create({})
    const { findByTestId, getByTestId } = renderChrome(model, 'chrome')
    const first = await findByTestId('probe-canvas')

    // half the invariant: remounting on anything but a re-init would drop a live
    // GPU context and re-run the backend factory for a changed status message
    act(() => {
      model.setStatus('Clustering samples', 0.25)
    })
    expect(getByTestId('probe-canvas')).toBe(first)
  })
})

// One element carries the display's whole identity. Three testid shapes and a
// second wrapper element used to split this across two nodes, which is what
// forced `PENDING_DISPLAYS` into a three-way union and `displayReady()` into a
// `:has()` variant. Both now assume co-location, so it is pinned here.
describe('the chrome element publishes the display identity', () => {
  test('testid, display id, phase and drawn all land on one element', async () => {
    const model = TestChromeModel.create({})
    const { findByTestId } = renderChrome(model, 'probe-display')

    const el = await findByTestId('probe-display')
    expect(el.getAttribute('data-display-id')).toBe('test-display')
    expect(el.getAttribute('data-display-phase')).toBe('ready')
    // `false`, not absent: `PENDING_DISPLAYS` selects on
    // `[data-display-drawn="false"]`, so an omitted attribute would make every
    // unpainted display look finished and every screenshot wait return early.
    expect(el.getAttribute('data-display-drawn')).toBe('false')

    act(() => {
      model.setCanvasDrawn(true)
    })
    const done = await findByTestId('probe-display-done')
    expect(done).toBe(el)
    expect(done.getAttribute('data-display-drawn')).toBe('true')
    expect(done.getAttribute('data-display-id')).toBe('test-display')
  })
})
