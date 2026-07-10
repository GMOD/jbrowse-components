import type { ComponentPropsWithRef, ReactNode } from 'react'

import { useRenderingBackend } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import TooLargeMessage from '../../shared/TooLargeMessage.tsx'

import type { DisplayErrorBarModel } from './DisplayErrorBar.tsx'
import type { DisplayLoadingOverlayModel } from './DisplayLoadingOverlay.tsx'
import type { TooLargeMessageModel } from '../../shared/TooLargeMessage.tsx'
import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'

// The model contract is the *union of what the chrome and its sub-overlays
// read*, composed directly from each overlay's own model prop type so it can't
// drift: add/remove a field an overlay reads and this updates with no edit here.
// The chrome itself reads only `displayPhase`/`height`/`canvasDrawn`; everything
// else flows through to a named overlay. (`renderError`/`setRenderError` are NOT
// here — they live on `RenderLifecycleModel`, always intersected in below.
// Loading-overlay *visibility* is derived from `displayPhase` by the chrome, so
// the overlay model doesn't re-encode `=== 'loading'`.)
export type ChromeModel = {
  displayPhase: DisplayPhase
  height: number
  canvasDrawn: boolean
} & DisplayErrorBarModel &
  TooLargeMessageModel &
  DisplayLoadingOverlayModel

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
// this component branches on it, and the loading scrim's visibility is just
// `displayPhase === 'loading'` (computed here once and passed to
// `DisplayLoadingOverlay`, never re-encoded as a per-model getter). So a display
// can't show a canvas while skipping a terminal state, can't bury the hook
// somewhere the chrome can't see (the seam alignments drifted through), and the
// loading-vs-terminal precedence isn't re-encoded by subtraction per display.
//
// The two subtree-replacing states (renderError, tooLarge) **early-`return`**
// their own component; `error` and `loading` are overlays drawn *over* the
// still-mounted canvas (the `ready` branch). Two non-obvious constraints make
// this work — guarded directly by DisplayChrome.test.tsx (co-located, fast) and
// originally confirmed by instrumenting StatsEstimation.test (the heavier
// integration guard); both reintroduce a real bug if violated:
//
//   1. The terminal UI must be a literal early-`return`, NOT a branch of a
//      single ternary `return`. The two produce an identical React element
//      tree, yet the ternary form makes a mobx-driven re-render fail to *commit*
//      (the `tooLarge → ready` transition and the `canvasDrawn → -done` flip):
//      the observer re-renders but React skips the commit. The cause is pinned:
//      `babel-plugin-react-compiler` memoizes a block whose dependency set omits
//      the in-place-mutated observable (`model` keeps stable identity), so a
//      referential memo never invalidates. It is NOT a jsdom artifact — toggling
//      only the compiler flips it, and the compiler emits the same JS for the
//      browser, so this drops updates in production too. Two ingredients are
//      BOTH required (verified at runtime + in compiled output, minimal repro in
//      `agent-docs/COMPILER_TERNARY_FINDING.md`): (a) `model.canvasDrawn` read
//      inside the ternary *expression* — this stops the compiler hoisting it to
//      an unconditional per-render `const`, so it stays in a memoized block; and
//      (b) `model` passed WHOLE to a child in that same block (here
//      `<DisplayErrorBar model={model}/>` / `<DisplayLoadingOverlay
//      model={model}/>`), which coarsens the block's memo dep from
//      `model.canvasDrawn` down to `model` IDENTITY — stable under mobx in-place
//      mutation, so it never re-evaluates. The early-`return` breaks (a): each
//      literal return is its own scope and the read hoists out as an
//      unconditional `const`, so mobx re-subscribes and the memo rebuilds.
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
  const phase = model.displayPhase
  // WARNING — DO NOT rewrite these as a ternary. Terminal states MUST be literal
  // early-`return`s: the ternary form makes a mobx-driven re-render skip its
  // commit under babel-plugin-react-compiler (real in-browser, not a jsdom
  // artifact). Full rule in the comment block above; analysis + minimal repro in
  // agent-docs/COMPILER_TERNARY_FINDING.md (keep in sync with babel.config.cjs +
  // ARCHITECTURE.md §1a).
  if (phase === 'renderError') {
    return (
      <DisplayRenderErrorOverlay
        error={model.renderError}
        onRetry={retry}
        height={model.height}
      />
    )
  }
  if (phase === 'tooLarge') {
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
      <DisplayLoadingOverlay
        model={model}
        visible={phase === 'loading'}
        // initial load (nothing painted yet) shows the indicator immediately;
        // a refetch over already-drawn content keeps the anti-flash delay
        immediate={!model.canvasDrawn}
      />
    </div>
  )
}

const DisplayChrome = observer(DisplayChromeInner)

export default DisplayChrome
