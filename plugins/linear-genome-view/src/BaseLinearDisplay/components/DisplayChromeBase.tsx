import { Fragment } from 'react'

import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import DisplayStatusChromeBase from './DisplayStatusChromeBase.tsx'

import type { StatusChromeModel } from './DisplayStatusChromeBase.tsx'
import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ComponentPropsWithRef, ReactNode } from 'react'

// What the chrome itself reads, on top of everything the overlays read
// (`StatusChromeModel`, composed from their own prop types in
// DisplayStatusChromeBase). (`renderError`/`setRenderError` are NOT here — they
// live on `RenderLifecycleModel`, always intersected in below.)
export type ChromeModel = {
  displayPhase: DisplayPhase
  height: number
  canvasDrawn: boolean
} & StatusChromeModel

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
// this component branches on it. So a display can't show a canvas while skipping
// a terminal state, can't bury the hook somewhere the chrome can't see (the seam
// alignments drifted through), and the loading-vs-terminal precedence isn't
// re-encoded by subtraction per display.
//
// This file owns only what the backend makes possible: the hook, and the
// `renderError` phase — the one phase whose banner needs the hook's `retry()`
// and so cannot live in the backend-free `DisplayStatusChromeBase` below it.
// Everything after that (the container, the `-done` testid,
// `data-display-phase`, the four remaining overlays) is shared verbatim with
// arc, which has no backend. See that file for the tree-shape rule.
//
// What it does NOT own is what those states look like. The five components come
// in via `overlays` so this file stays free of any UI toolkit; `DisplayChrome`
// binds the MUI set and is what every in-tree display imports. See
// chromeOverlays.ts for why that split exists.
//
// `displayPhase`'s loading term is evaluated lazily (a thunk in
// `computeDisplayPhase`) so that when a terminal flag is set this observer tracks
// ONLY that flag — not the containing view's `visibleRegions` / `loadedRegions` —
// avoiding needless re-renders while a banner is up. (This component carries
// `'use no memo'`, so the react-compiler staleness that once made the terminal
// branches sensitive to early-`return`-vs-ternary no longer applies; see the
// directive below and `agent-docs/reference/COMPILER_TERNARY_FINDING.md`.)
//
// The body is a function so callers mount the canvas wherever it belongs. It
// returns a named observer component (every display does) so observable reads
// scope to the body rather than re-rendering the chrome.
//
// A hook bound to the chrome *container* (pointer tracking, maf's drag-select)
// does have to be called in the caller, because that is where the ref is — but
// **do not hold its per-event state there too.** Every consumer of
// `useMouseTracking` once did, and the bill was a whole display's chrome
// re-rendering because the cursor moved a pixel over it: this component
// (re-running `useRenderingBackend`), the status container with a fresh inline
// `style` object, all three overlays, and only then the body that actually
// wanted the coordinate. Publish the value and read it in the body instead —
// `useMouseTracking` returns a `mouseTracker` for exactly this and
// `useMouseState` reads it, which also coalesces to one update per frame.
//
// maf's `useDragSelection` is the one holdout: its pointer position shares a
// `useState` with the drag rectangle, and `useDragSelection.test.ts` asserts on
// that state synchronously, so splitting them needs the test reworked too.
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
  overlays,
  ...chromeProps
}: {
  model: ChromeModel & RenderLifecycleModel<B>
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  children: (handle: CanvasHandle) => ReactNode
  testid: string
  overlays: DisplayChromeOverlays
} & Omit<ComponentPropsWithRef<'div'>, 'children'>) {
  // eslint-plugin-react-compiler (react-compiler@19.1.0-rc.2) thinks this
  // directive is unused, but the babel plugin (@1.0.0, the real build) DOES
  // compile this fn — version skew. The directive is load-bearing; keep it.
  // eslint-disable-next-line react-compiler/react-compiler
  'use no memo'
  const { canvas, canvasRef, retry, canvasKey } = useRenderingBackend(
    factory,
    model,
  )
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
  // `phase` is narrowed to DisplayStatusPhase by the return above, which is the
  // whole point of the two phase types: the backend-free chrome can't be handed
  // a state whose banner it has no `retry()` to build.
  return (
    <DisplayStatusChromeBase
      {...chromeProps}
      model={model}
      phase={phase}
      drawn={model.canvasDrawn}
      overlays={overlays}
    >
      {/* Keyed on `canvasKey` so a backend re-init always gets a canvas element
          that never held a context, whichever path triggered it. The old
          reasoning — "DisplayChrome consumers get this free, the `renderError`
          phase unmounts the canvas" — holds only for a *reported* loss. Three
          re-init paths bump `canvasKey` without ever setting `renderError`
          (`webglcontextrestored`, WebGPU `onDeviceLost`, a bfcache `pageshow`),
          and on those the element was reused. Usually fine, since the same
          context kind is re-acquirable; not fine when the HAL ladder lands on a
          *different* rung than last time, because a canvas's context kind is
          permanent — a device loss that can't re-acquire WebGPU falls to WebGL2
          and finds the element already committed, which is unrecoverable on
          that element. This makes the guarantee unconditional rather than a
          property of which path happened to fire, and it costs a remount of the
          body on an event that is rebuilding the whole backend anyway. The
          overlays deliberately sit OUTSIDE the key: remounting the loading
          scrim would reset its 250ms anti-flash timer (see
          DisplayStatusChromeBase). */}
      <Fragment key={canvasKey}>{children({ canvasRef, canvas })}</Fragment>
    </DisplayStatusChromeBase>
  )
}

const DisplayChromeBase = observer(DisplayChromeBaseInner)

export default DisplayChromeBase
