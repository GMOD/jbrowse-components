import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import type { TooLargeMessageModel } from '../../shared/TooLargeMessage.tsx'
import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { DisplayBackgroundProgressModel } from './DisplayBackgroundProgress.tsx'
import type { DisplayErrorBarModel } from './DisplayErrorBar.tsx'
import type { DisplayLoadingOverlayModel } from './DisplayLoadingOverlay.tsx'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ComponentPropsWithRef, ReactNode } from 'react'

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
  DisplayLoadingOverlayModel &
  DisplayBackgroundProgressModel

interface CanvasHandle {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}

// Single home for every GPU display's render lifecycle AND status chrome.
// DisplayChromeBase owns the backend hook (`useRenderingBackend`) and decides
// which terminal-state UI shows, but the *states themselves* all live on the
// model and collapse to one getter, `model.displayPhase`
// ('renderError' | 'tooLarge' | 'error' | 'loading' | 'ready'). The precedence
// among them is single-sourced in `computeDisplayPhase` (see displayPhase.ts);
// this component branches on it, and the loading scrim's visibility is just
// `displayPhase === 'loading'` (computed here once and passed to
// `overlays.Loading`, never re-encoded as a per-model getter). So a display
// can't show a canvas while skipping a terminal state, can't bury the hook
// somewhere the chrome can't see (the seam alignments drifted through), and the
// loading-vs-terminal precedence isn't re-encoded by subtraction per display.
//
// What it does NOT own is what those states look like. The five components come
// in via `overlays` so this file stays free of any UI toolkit; `DisplayChrome`
// binds the MUI set and is what every in-tree display imports. See
// chromeOverlays.ts for why that split exists.
//
// The two subtree-replacing states (renderError, tooLarge) **early-`return`**
// their own component; `error` and `loading` are overlays drawn *over* the
// still-mounted canvas (the `ready` branch).
//
// `displayPhase`'s loading term is evaluated lazily (a thunk in
// `computeDisplayPhase`) so that when a terminal flag is set this observer tracks
// ONLY that flag — not the containing view's `visibleRegions` / `loadedRegions` —
// avoiding needless re-renders while a banner is up. (This component carries
// `'use no memo'`, so the react-compiler staleness that once made the terminal
// branches sensitive to early-`return`-vs-ternary no longer applies; see the
// directive below and `agent-docs/reference/COMPILER_TERNARY_FINDING.md`.)
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
// Must stay the `function Decl(){}; observer(Decl)` form (not inline
// `observer(function(){})`) because the generic `<B>` only infers through
// `observer` from a named declaration. That form IS compiled by
// babel-plugin-react-compiler, so it carries `'use no memo'` below to opt out —
// otherwise the compiler can memoize a MobX read on stable identity and drop an
// update (see agent-docs/reference/COMPILER_TERNARY_FINDING.md).
function DisplayChromeBaseInner<B extends { dispose(): void }>({
  model,
  factory,
  children,
  testid,
  style,
  overlays,
  ...divProps
}: {
  model: ChromeModel & RenderLifecycleModel<B>
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  children: (handle: CanvasHandle) => ReactNode
  testid?: string
  overlays: DisplayChromeOverlays
} & Omit<ComponentPropsWithRef<'div'>, 'children'>) {
  // eslint-plugin-react-compiler (react-compiler@19.1.0-rc.2) thinks this
  // directive is unused, but the babel plugin (@1.0.0, the real build) DOES
  // compile this fn — version skew. The directive is load-bearing; keep it.
  // eslint-disable-next-line react-compiler/react-compiler
  'use no memo'
  const { canvas, canvasRef, retry } = useRenderingBackend(factory, model)
  const phase = model.displayPhase
  if (phase === 'renderError') {
    return (
      <overlays.RenderError
        error={model.renderError}
        onRetry={retry}
        height={model.height}
      />
    )
  }
  if (phase === 'tooLarge') {
    return <overlays.TooLarge model={model} />
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
      // The `-done` suffix above is `canvasDrawn`, i.e. FIRST PAINT — it flips
      // on an empty canvas while the fetch is still in flight, so it can't
      // answer "is this display finished". `phase` can: it is the model's own
      // mutually-exclusive state, and `loading` covers the whole fetch, not
      // just the paint. Published so a screenshot/e2e run can wait on the real
      // signal instead of inferring it from paint flags and overlay text.
      data-display-phase={phase}
    >
      {children({ canvasRef, canvas })}
      <overlays.ErrorBar model={model} />
      <overlays.Loading
        model={model}
        visible={phase === 'loading'}
        // initial load (nothing painted yet) shows the indicator immediately;
        // a refetch over already-drawn content keeps the anti-flash delay
        immediate={!model.canvasDrawn}
      />
      {/* the same status channel, for work with no fetch behind it (clustering)
          — a corner chip, since the drawn content stays usable meanwhile */}
      <overlays.BackgroundProgress model={model} visible={phase === 'ready'} />
    </div>
  )
}

const DisplayChromeBase = observer(DisplayChromeBaseInner)

export default DisplayChromeBase
