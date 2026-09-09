import { useMouseState } from '@jbrowse/core/ui/useMouseTracking'
import { types } from '@jbrowse/mobx-state-tree'
import {
  isGpuRenderingDisabled,
  setGpuOverride,
} from '@jbrowse/render-core/gpuDevice'
import { createGpuContextLostError } from '@jbrowse/render-core/useRenderingBackend'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { observer } from 'mobx-react'

import BottomRightIndicators from './BottomRightIndicators.tsx'
import DisplayChrome, { DisplayStatusChrome } from './DisplayChrome.tsx'
import { TestChromeModel, stubFactory } from './chromeTestModel.ts'

import type {
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui/useMouseTracking'
import type { YAxis } from '@jbrowse/display-ui'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Fast guard that the banner/overlay/canvas subtrees actually COMMIT to the DOM
// (via Testing Library `findBy*`) across mobx-driven transitions — the historical
// bug was a returned-but-never-committed subtree.
//
// That bug was `babel-plugin-react-compiler` memoizing a MobX read on stable
// identity; `DisplayChromeBaseInner` now carries `'use no memo'`, so it is no
// longer compiled and the ternary-vs-early-`return` sensitivity is gone (see
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

test('ready phase shows the canvas with no banners; the testid does NOT change on paint', async () => {
  const model = TestChromeModel.create({})
  const { findByTestId, getByTestId, queryByTestId } = renderChrome(
    model,
    'chrome',
  )

  await findByTestId('probe-canvas')
  expect(queryByTestId('loading-overlay')).toBeNull()
  const before = getByTestId('chrome')
  expect(before.dataset.displayDrawn).toBe('false')

  act(() => {
    model.setCanvasDrawn(true)
  })

  // The regression guard for ADR-065. The chrome used to rename this element to
  // `chrome-done` on first paint, which is why `data-testid` was the only
  // mutating testid in the tree; paint is an attribute now and the id is a
  // stable handle. Same element throughout — not a remount.
  const after = getByTestId('chrome')
  expect(after).toBe(before)
  expect(after.dataset.displayDrawn).toBe('true')
  expect(queryByTestId('chrome-done')).toBeNull()
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

// Two independent things want the bottom-right corner and neither can see the
// other: this chip, which the chrome renders, and the display's own control row,
// which the display renders several components down. Both used to pin themselves
// to `bottom: 2; right: 2` of the same per-track overlay layer, so they drew on
// top of each other — the controls winning on z-index, the status text vanishing
// underneath. It has never been reachable (the two displays with a control row
// are not among the four that report a ready-phase status), which is the reason
// to make it structural rather than to leave it: nothing on either side is aware
// of the constraint. See `@jbrowse/display-ui`'s bottomRightCorner.ts.
describe('the bottom-right corner has one owner', () => {
  function renderWithControls(model: Instance<typeof TestChromeModel>) {
    return render(
      <DisplayChrome model={model} factory={stubFactory} testid="chrome">
        {({ canvasRef }) => (
          <>
            <canvas data-testid="probe-canvas" ref={canvasRef} />
            <BottomRightIndicators>
              <button type="button" data-testid="probe-control">
                size
              </button>
            </BottomRightIndicators>
          </>
        )}
      </DisplayChrome>,
    )
  }

  test('the status chip and the control row land in one anchored box', async () => {
    const model = TestChromeModel.create({})
    act(() => {
      model.setStatus('Clustering samples', 0.25)
    })
    const { findByTestId, getByTestId } = renderWithControls(model)

    const chip = await findByTestId('progress-chip')
    const controlRow = getByTestId('probe-control').parentElement!
    const corner = chip.parentElement
    expect(corner).toBe(controlRow.parentElement)
    expect(corner!.style.position).toBe('absolute')
    // and the row joined it rather than pinning itself, which is the half that
    // regresses if someone reinstates the row's own `position: absolute`
    expect(controlRow.style.position).toBe('')
  })

  test('the chip stacks above the controls, by explicit order', async () => {
    const model = TestChromeModel.create({})
    act(() => {
      model.setStatus('Clustering samples', 0.25)
    })
    const { findByTestId, getByTestId } = renderWithControls(model)

    // `order`, not DOM position: one member arrives as a portal and the other as
    // an ordinary child, and React documents no ordering between those two. The
    // chip stays on CSS's default 0 and the row asks to sort below it.
    const chip = await findByTestId('progress-chip')
    const controlRow = getByTestId('probe-control').parentElement!
    expect(chip.style.order).toBe('')
    expect(Number(controlRow.style.order)).toBeGreaterThan(0)
  })

  // The trap the chip's own wrapper would have been: a component returning null
  // contributes no DOM node, but a wrapper around it stays a zero-height flex
  // ITEM and spends the column's `gap`, lifting the control row off the corner
  // on every display that has one and no background job — which is all of them,
  // nearly all of the time.
  test('with no status the controls keep the corner to themselves', async () => {
    const model = TestChromeModel.create({})
    const { findByTestId, getByTestId } = renderWithControls(model)

    await findByTestId('probe-canvas')
    const controlRow = getByTestId('probe-control').parentElement!
    const corner = controlRow.parentElement!
    expect(getByTestId('chrome')).toBeTruthy()
    expect(corner.childElementCount).toBe(1)
  })

  test('with no chrome above it the row still anchors itself', () => {
    const { getByTestId } = render(
      <BottomRightIndicators>
        <button type="button" data-testid="probe-control">
          size
        </button>
      </BottomRightIndicators>,
    )
    // a display mounted standalone, a unit test, the SVG export: no corner to
    // join and nothing in it to collide with
    expect(getByTestId('probe-control').parentElement!.style.position).toBe(
      'absolute',
    )
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

// The distinction the screenshot generator depends on: `data-display-drawn` is
// first paint, `data-display-phase` is doneness. A display that has painted an
// empty canvas while its fetch is still running reports BOTH `drawn` and
// `loading`, so a capture gated on paint alone lands on a half-loaded frame.
test('data-display-phase reports loading even once canvasDrawn has flipped', async () => {
  const model = TestChromeModel.create({})
  model.setLoadingCondition(true)
  model.setCanvasDrawn(true)
  const { findByTestId } = renderChrome(model, 'chrome')

  const el = await findByTestId('chrome')
  expect(el.dataset.displayPhase).toBe('loading')

  act(() => {
    model.setLoadingCondition(false)
  })

  expect(el.dataset.displayPhase).toBe('ready')
})

// The reader outside the display. `data-display-drawn` is what
// `PENDING_DISPLAYS` (@jbrowse/browser-test-utils) selects on, and a display
// that deliberately paints no canvas — sequence past base resolution, LD with
// the triangle off — can never flip `canvasDrawn`. Read off the raw flag it
// published `"false"` forever, so every `waitForDisplaysDone` on the page burned
// its full timeout, silently (that wait swallows its own). `painted` is the
// getter both states answer.
test('a display that renders no canvas reports drawn, not pending', async () => {
  const model = TestChromeModel.create({ rendersCanvas: false })
  const { findByTestId } = renderChrome(model, 'chrome')

  // reports painted without ever waiting on a canvas that is never mounted
  const el = await findByTestId('chrome')
  expect(el.dataset.displayDrawn).toBe('true')
  expect(model.canvasDrawn).toBe(false)
})

test('a canvas-painting display still reports pending until first paint', async () => {
  const model = TestChromeModel.create({})
  const { findByTestId } = renderChrome(model, 'chrome')

  const el = await findByTestId('chrome')
  expect(el.dataset.displayDrawn).toBe('false')

  act(() => {
    model.setCanvasDrawn(true)
  })
  expect(el.dataset.displayDrawn).toBe('true')
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
  // An observer that reads `model.displayPhase` itself, because that is what
  // both real callers are (`DisplayChromeBase`, and arc's
  // `BaseDisplayComponent`): `DisplayStatusChrome` takes the phase as a prop
  // precisely so the *caller* owns the tracking. Reading it once outside the
  // render instead left the fixture pinned to a stale phase, and the suite
  // passed only because `ErrorBar` used to re-derive its own visibility from
  // `model.error` — i.e. only while an overlay was free to disagree with the
  // phase it had been handed.
  const StatusProbe = observer(function StatusProbe({
    model,
    testid,
  }: {
    model: Instance<typeof TestChromeModel>
    testid: string
  }) {
    // a backend-less display never reaches `renderError`, which is exactly what
    // DisplayStatusPhase encodes — so the phase is passed through unchanged
    const phase = model.displayPhase
    if (phase === 'renderError') {
      throw new Error('unreachable: the fixture sets no renderError here')
    }
    return (
      <DisplayStatusChrome
        model={model}
        phase={phase}
        drawn={model.painted}
        testid={testid}
      >
        <div data-testid="probe-body" />
      </DisplayStatusChrome>
    )
  })

  function renderStatusChrome(
    model: Instance<typeof TestChromeModel>,
    testid = 'probe-display',
  ) {
    return render(<StatusProbe model={model} testid={testid} />)
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

  test('owns the stable testid and publishes data-display-phase', async () => {
    const model = TestChromeModel.create({})
    model.setLoadingCondition(true)
    const { findByTestId } = renderStatusChrome(model, 'status')

    const el = await findByTestId('status')
    expect(el.dataset.displayPhase).toBe('loading')

    act(() => {
      model.setCanvasDrawn(true)
    })
    await findByTestId('status')
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

// The scrim's `immediate` is `!painted`, so it flips in the middle of a load
// that started before first paint — region 1 drawn, regions 2..n still fetching,
// phase still `loading` throughout. `immediate` must BYPASS the 250ms anti-flash
// delay, not restart it; `LoadingOverlay` used to feed `!immediate` into the
// delay's own input, so the flip started a fresh window from zero and the scrim
// blinked out mid-load.
//
// It has to be pinned here rather than on `LoadingOverlay` directly: RTL's
// `rerender` remounts that component, which resets the delay's state and makes a
// prop-flip assertion pass or fail for reasons unrelated to the timer. Coming
// through MobX on a mounted tree is the real path and the only honest probe.
describe('the loading scrim spans one continuous load', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  test('stays up when first paint lands while still loading', () => {
    const model = TestChromeModel.create({})
    model.setLoadingCondition(true)
    const { queryByTestId } = renderChrome(model)

    // nothing painted yet, so it shows without waiting out the delay
    expect(queryByTestId('loading-overlay')).not.toBeNull()
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(queryByTestId('loading-overlay')).not.toBeNull()

    act(() => {
      model.setCanvasDrawn(true)
    })

    expect(model.displayPhase).toBe('loading')
    expect(queryByTestId('loading-overlay')).not.toBeNull()
  })

  // the other half: a refetch over already-drawn content still gets the delay,
  // which is the whole reason the flag exists
  test('a refetch over drawn content still waits out the anti-flash delay', () => {
    const model = TestChromeModel.create({})
    model.setCanvasDrawn(true)
    const { queryByTestId } = renderChrome(model)

    act(() => {
      model.setLoadingCondition(true)
    })
    expect(queryByTestId('loading-overlay')).toBeNull()

    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(queryByTestId('loading-overlay')).not.toBeNull()
  })

  // What the delay is FOR, and the case the hook's rising-edge rewrite must not
  // change: a display refetching through a wheel zoom finishes one fetch, waits
  // out its debounce and starts the next, so the loading flag pulses several
  // times a second. Each pulse is shorter than the delay, so the scrim must
  // never appear — the delay does not accumulate across them.
  test('two short loading pulses separated by a gap raise no scrim', () => {
    const model = TestChromeModel.create({})
    model.setCanvasDrawn(true)
    const { queryByTestId } = renderChrome(model)

    for (const _ of [0, 1]) {
      act(() => {
        model.setLoadingCondition(true)
      })
      act(() => {
        jest.advanceTimersByTime(150)
      })
      expect(queryByTestId('loading-overlay')).toBeNull()
      act(() => {
        model.setLoadingCondition(false)
      })
      act(() => {
        jest.advanceTimersByTime(150)
      })
      expect(queryByTestId('loading-overlay')).toBeNull()
    }

    // and the delay still works after them: a pulse that does outlast it shows
    act(() => {
      model.setLoadingCondition(true)
    })
    act(() => {
      jest.advanceTimersByTime(250)
    })
    expect(queryByTestId('loading-overlay')).not.toBeNull()
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

// A terminal state replaces the subtree, which removes the very element the
// chrome's pointer handlers are bound to — and `mouseleave` cannot fire on an
// element unmounted under the cursor. Nothing reads the tracker while the banner
// is up, which is what hides the leak: the body remounts the instant the phase
// clears (Force load, Retry) and reads the stale snapshot on its first render.
// The pointer layers with no other gate (multi-row features, maf, both
// multi-sample variant displays) draw a crosshair there straight away.
describe('the pointer measurement drops when the container is replaced', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  // What a real pointer layer does: read the tracker in the body and draw from
  // it. Rendering the value is what makes "the body's FIRST render after the
  // remount" observable at all.
  function PointerProbe({ tracker }: { tracker: MouseTracker }) {
    const state = useMouseState(tracker)
    return (
      <div data-testid="probe-pointer">
        {state ? `${state.x},${state.y}` : 'none'}
      </div>
    )
  }

  function renderTracked(
    model: Instance<typeof TestChromeModel>,
    onPointerPosition?: (state?: MouseState) => void,
  ) {
    return render(
      <DisplayChrome
        model={model}
        factory={stubFactory}
        testid="chrome"
        onPointerPosition={onPointerPosition}
      >
        {({ canvasRef, mouseTracker }) => (
          <>
            <canvas data-testid="probe-canvas" ref={canvasRef} />
            <PointerProbe tracker={mouseTracker} />
          </>
        )}
      </DisplayChrome>,
    )
  }

  // the measurement is rAF-coalesced, so a move only lands on the next frame
  function moveOver(el: HTMLElement, clientX: number, clientY: number) {
    act(() => {
      fireEvent.mouseMove(el, { clientX, clientY })
      jest.advanceTimersByTime(20)
    })
  }

  test('tooLarge clears it, so the remounted body starts with no pointer', () => {
    const model = TestChromeModel.create({})
    const { getByTestId } = renderTracked(model)

    moveOver(getByTestId('chrome'), 30, 12)
    expect(getByTestId('probe-pointer').textContent).toBe('30,12')

    act(() => {
      model.setRegionTooLarge(true, 'Requested too much data')
    })
    // force load: the body comes back, and must not come back mid-hover
    act(() => {
      model.setRegionTooLarge(false)
    })
    expect(getByTestId('probe-pointer').textContent).toBe('none')
  })

  test('renderError clears it too, and the hit goes with it', () => {
    const seen: (MouseState | undefined)[] = []
    const model = TestChromeModel.create({})
    const { getByTestId } = renderTracked(model, state => {
      seen.push(state)
    })

    moveOver(getByTestId('chrome'), 8, 40)
    expect(seen.at(-1)).toMatchObject({ x: 8, y: 40 })

    act(() => {
      model.setRenderError(new Error('boom'))
    })
    // `onPointerPosition` consumers (hoveredFeature, hoveredFeature) would
    // otherwise stay pinned to the hit under the banner
    expect(seen.at(-1)).toBeUndefined()

    act(() => {
      model.setRenderError(undefined)
    })
    expect(getByTestId('probe-pointer').textContent).toBe('none')
  })

  // the other half: only a *replaced* container clears it, not any re-render —
  // otherwise a status tick during a hover would drop the crosshair
  test('an overlay phase keeps it, because the container is still there', () => {
    const model = TestChromeModel.create({})
    const { getByTestId } = renderTracked(model)

    moveOver(getByTestId('chrome'), 5, 6)
    act(() => {
      model.setStatus('Downloading', 0.5)
      model.setLoadingCondition(true)
    })
    expect(getByTestId('probe-pointer').textContent).toBe('5,6')
  })
})

// A clustered figure with the sidebar hidden has no DOM evidence the run
// finished except this attribute, so it is the chrome's to publish rather than
// each sidebar display's — two of the four forgot.
test('the chrome publishes data-clustered off the positioned tree', async () => {
  const model = TestChromeModel.create({})
  const { findByTestId } = renderChrome(model, 'chrome')

  const el = await findByTestId('chrome')
  expect(el.dataset.clustered).toBe('false')
  act(() => {
    model.setHierarchy({})
  })
  expect(el.dataset.clustered).toBe('true')
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
    expect(el.dataset.displayId).toBe('test-display')
    expect(el.dataset.displayPhase).toBe('ready')
    // `false`, not absent: `PENDING_DISPLAYS` selects on
    // `[data-display-drawn="false"]`, so an omitted attribute would make every
    // unpainted display look finished and every screenshot wait return early.
    expect(el.dataset.displayDrawn).toBe('false')

    act(() => {
      model.setCanvasDrawn(true)
    })
    const done = await findByTestId('probe-display')
    expect(done).toBe(el)
    expect(done.dataset.displayDrawn).toBe('true')
    expect(done.dataset.displayId).toBe('test-display')
  })
})

// The chrome draws the axes of a display declaring value scales off the ticks
// its mixin derived, so no display places its own: one axis per band each
// scale rules, in a gutter on the side the scale declares, and the `[min, max]`
// caption for a scale with no room for one.
describe('the y axis', () => {
  const ticks = {
    items: [
      { value: 0, y: 95 },
      { value: 10, y: 5 },
    ],
    yTop: 5,
    yBottom: 95,
  }
  const AxisModel = TestChromeModel.props({
    axes: types.frozen<YAxis[]>([]),
    showCrossHatches: false,
  }).views(() => ({
    get canvasWidthPx() {
      return 400
    },
  }))
  const scale = (over: Partial<YAxis> = {}): YAxis => ({
    domain: [0, 10],
    scaleType: 'linear',
    height: 100,
    ticks,
    ...over,
  })
  const labelsOf = (container: HTMLElement) =>
    [...container.querySelectorAll('text')].map(t => t.textContent)
  const overlays = (container: HTMLElement) =>
    [...container.querySelectorAll('svg')].map(svg => svg.style)

  test('a declared scale places the axis in the left gutter and, when shown, the hatches', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({ axes: [scale()], showCrossHatches: true }),
    )
    await findByTestId('probe-canvas')
    expect(labelsOf(container)).toEqual(['0', '10'])
    const [hatches, axis] = overlays(container)
    expect(hatches?.left).toBe('0px')
    expect(axis?.left).toBe('0px')
    expect(axis?.width).toBe('50px')
    expect(axis?.top).toBe('0px')
  })

  test('no declared scale draws no axis', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({ showCrossHatches: true }),
    )
    await findByTestId('probe-canvas')
    expect(container.querySelectorAll('svg')).toHaveLength(0)
  })

  // A grouped alignments track repeats its coverage band per group; the one
  // scale rules them all, so each band gets the same axis at its own top —
  // and a band scrolled off the display gets none.
  test('a scale ruling several bands gets an axis per band on screen', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({
        axes: [scale({ height: 40, bandTops: [0, 60, 500] })],
      }),
    )
    await findByTestId('probe-canvas')
    expect(overlays(container).map(s => s.top)).toEqual(['0px', '60px'])
    expect(labelsOf(container)).toEqual(['0', '10', '0', '10'])
  })

  test('a right-side scale takes the gutter inside the right edge', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({ axes: [scale({ side: 'right' })] }),
    )
    await findByTestId('probe-canvas')
    const [axis] = overlays(container)
    // 400 wide, less the scrollbar clearance and the gutter
    expect(Number.parseFloat(axis!.left)).toBeLessThan(400 - 50)
    expect(Number.parseFloat(axis!.left)).toBeGreaterThan(300)
  })

  // A dendrogram panel takes the left edge; the gutter starts past it.
  test('a scale with a panel at the left starts its gutter past it', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({ axes: [scale({ left: 40 })] }),
    )
    await findByTestId('probe-canvas')
    expect(overlays(container)[0]?.left).toBe('40px')
  })

  // Below COMPACT_AXIS_HEIGHT the labels would overlap, so the scale is
  // captioned once at the top-right instead — and the hatches go with the
  // axis. A scale ruling no band (density rows each in their own colour) is
  // captioned the same way.
  test('a scale too short for an axis is captioned, hatches and all', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({
        axes: [scale({ height: 20, bandTops: [0, 20, 40] })],
        showCrossHatches: true,
      }),
    )
    await findByTestId('probe-canvas')
    expect(labelsOf(container)).toEqual(['[0, 10]'])
    expect(container.querySelectorAll('line')).toHaveLength(0)
  })

  test('a scale ruling no band is captioned, naming its scale type', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({
        axes: [scale({ scaleType: 'log', bandTops: [] })],
      }),
    )
    await findByTestId('probe-canvas')
    expect(labelsOf(container)).toEqual(['[0, 10] (log)'])
  })

  test('a scale with a caption names its axis beside it', async () => {
    const { container, findByTestId } = renderChrome(
      AxisModel.create({ axes: [scale({ caption: 'TLEN' })] }),
    )
    await findByTestId('probe-canvas')
    expect(labelsOf(container)).toEqual(['0', '10', 'TLEN'])
  })
})

// The chrome lights what a display answering `hoverInk` says is hovered or
// selected, in the style the host names, so no display places a box of its
// own; a display answering nothing gets no box.
describe('the highlight', () => {
  const HighlightModel = TestChromeModel.props({
    lit: true,
    style: types.maybe(types.string),
  }).views(self => ({
    get hoverInk() {
      return self.lit
        ? [
            { left: 10, top: 20, width: 30, height: 5 },
            { left: 50, top: 20, width: 30, height: 5, strong: true },
          ]
        : []
    },
    get selectionInk() {
      return self.lit ? [{ left: 90, top: 0, width: 4, height: 4 }] : []
    },
    get highlightStyle() {
      return self.style
    },
  }))

  test('each rect is one positioned div, the strong one in the heavier shade', async () => {
    const { findAllByTestId, findByTestId, queryAllByTestId } = renderChrome(
      HighlightModel.create({}),
    )
    await findByTestId('probe-canvas')
    const [weak, strong] = await findAllByTestId('chrome-hover')
    expect(weak!.style.left).toBe('10px')
    expect(weak!.style.width).toBe('30px')
    expect(strong!.style.background).not.toBe(weak!.style.background)
    expect(queryAllByTestId('chrome-selection')).toHaveLength(1)
  })

  test('the box style is a wash with a border, and nothing lit draws nothing', async () => {
    const boxed = renderChrome(HighlightModel.create({ style: 'box' }))
    await boxed.findByTestId('probe-canvas')
    const [box] = await boxed.findAllByTestId('chrome-hover')
    expect(box!.style.border).toContain('1px solid')
    boxed.unmount()
    const dark = renderChrome(HighlightModel.create({ lit: false }))
    await dark.findByTestId('probe-canvas')
    expect(dark.queryAllByTestId('chrome-hover')).toHaveLength(0)
  })
})
