import type { ComponentPropsWithRef, ReactNode } from 'react'

import { useRenderingBackend } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import TooLargeMessage from '../../shared/TooLargeMessage.tsx'

import type { DisplayPhase } from '@jbrowse/core/gpu/displayPhase'
import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'

// `renderError`/`setRenderError` are NOT here — they live on
// `RenderLifecycleModel`, which the chrome's model is always intersected with.
// These are the fetch/region/status fields DisplayChrome reads itself or hands
// to its sub-overlays.
export interface ChromeModel {
  error: unknown
  reload: () => void
  forceLoad: () => void
  displayPhase: DisplayPhase
  loadingOverlayVisible: boolean
  statusMessage?: string
  regionTooLarge: boolean
  regionTooLargeReason: string
  height: number
  canvasDrawn: boolean
}

interface CanvasHandle {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}

// Single home for every GPU display's render lifecycle AND status chrome.
// DisplayChrome owns the backend hook (`useRenderingBackend`) and renders the
// terminal-state UI, but the *states themselves* all live on the model and
// collapse to one getter, `model.displayPhase`
// ('renderError' | 'tooLarge' | 'error' | 'loading' | 'ready'). The precedence
// among them is single-sourced in `computeDisplayPhase` (see displayPhase.ts);
// this component branches on it, and `loadingOverlayVisible` is just
// `displayPhase === 'loading'`. So a display can't show a canvas while skipping
// a terminal state, can't bury the hook somewhere the chrome can't see (the
// seam alignments drifted through), and the loading-vs-terminal precedence
// isn't re-encoded by subtraction in each model's `loadingOverlayVisible`.
//
// The two subtree-replacing states (renderError, tooLarge) **early-`return`**
// their own component; `error` and `loading` are overlays drawn *over* the
// still-mounted canvas (the `ready` branch). Two non-obvious constraints make
// this work — both confirmed by instrumenting StatsEstimation.test, both
// reintroduce a real bug if violated:
//
//   1. The terminal UI must be a literal early-`return`, NOT a branch of a
//      single ternary `return`. The two produce an identical React element
//      tree, yet under React 19 + mobx-react + jsdom the ternary form fails to
//      *commit* the banner subtree — `TooLargeMessage`'s body never runs and it
//      never reaches the DOM (the test times out). The early-`return` commits
//      reliably. (This is the previously-"unconfirmed" reconciliation hazard;
//      the symptom is real even if the React-internal cause isn't pinned down.)
//
//   2. `displayPhase`'s loading term is evaluated lazily (a thunk in
//      `computeDisplayPhase`) so that when a terminal flag is set this observer
//      tracks ONLY that flag — not the containing view's `visibleRegions` /
//      `loadedRegions`. Tracking those during a terminal state churns the
//      observer and reproduces failure (1) even with the early-`return`. Lazy
//      evaluation keeps the tracked set identical to the old direct reads.
//
// Early-`return` also gives the canvas a clean dispose/re-init: unmounting the
// body fires `canvasRef(null)` → effect cleanup → `backend.dispose()` +
// `stopRenderingBackend()`, then force-load remounts (ADR-025). It looks like a
// leak (caller className/ref/mouse handlers are absent in those two states) but
// the leak is benign — a too-large region has no canvas to interact with, and
// the ref re-attaches on force-load. Don't "fix" it by nesting the banner.
//
// The body is a function so callers mount the canvas wherever it belongs. It
// returns a named observer component (every display does) so observable reads
// scope to the body rather than re-rendering the chrome. An outer hook bound to
// the chrome container (maf's drag-select, alignments' mouse tracking) stays in
// the caller and threads its state down as a prop.
//
// `testid` is the *base* first-paint selector; the chrome owns the `-done`
// convention, appending it once `canvasDrawn` flips, so no consumer hand-writes
// the ternary and the separator/gating can't drift. Tests wait on
// `${testid}-done` (the single first-paint signal), then read the canvas inside.
// Displays whose tests pixel-match or screenshot the canvas itself (hic, ld)
// give the inner <canvas> a *static* selector (`hic_canvas`) for that lookup —
// the readiness gate stays here on the chrome div, never duplicated as a
// `canvasDrawn`/`rpcData` ternary on the canvas.
function DisplayChromeInner<B extends { dispose(): void }>({
  model,
  factory,
  children,
  testid,
  style,
  ...divProps
}: {
  model: ChromeModel & RenderLifecycleModel<B>
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  children: (handle: CanvasHandle) => ReactNode
  testid?: string
} & Omit<ComponentPropsWithRef<'div'>, 'children'>) {
  const { canvas, canvasRef, retry } = useRenderingBackend(factory, model)
  // Terminal states are literal early-`return`s, NOT ternary branches of a
  // single return — empirically the two are NOT interchangeable here (identical
  // element tree, but the ternary form fails to commit the banner subtree in
  // React 19 + mobx-react + jsdom; StatsEstimation.test catches it). See the
  // comment block above for the full rule.
  if (model.displayPhase === 'renderError') {
    return (
      <DisplayRenderErrorOverlay
        error={model.renderError}
        onRetry={retry}
        height={model.height}
      />
    )
  }
  if (model.displayPhase === 'tooLarge') {
    return <TooLargeMessage model={model} />
  }
  return (
    <div
      {...divProps}
      // DisplayChrome owns the positioning context: the loading scrim and error
      // bar below are position:absolute children, so the container must be the
      // containing block. Centralized here so no caller has to remember it (and
      // so the two that didn't — hic, ld — stop leaking their overlays to an
      // ancestor). Caller `style` still wins if it overrides `position`.
      style={{ position: 'relative', ...style }}
      data-testid={
        testid === undefined
          ? undefined
          : `${testid}${model.canvasDrawn ? '-done' : ''}`
      }
    >
      {children({ canvasRef, canvas })}
      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay model={model} />
    </div>
  )
}

const DisplayChrome = observer(DisplayChromeInner)

export default DisplayChrome
