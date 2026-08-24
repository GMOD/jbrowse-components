import { Fragment, useEffect } from 'react'

// deep subpath, never the `@jbrowse/core/ui` barrel: this file is the
// toolkit-free half of the chrome and the barrel pulls in MUI
import { useMouseTracking } from '@jbrowse/core/ui/useMouseTracking'
import { useRenderingBackend } from '@jbrowse/render-core/useRenderingBackend'
import { observer } from 'mobx-react'

import DisplayStatusChromeBase from './DisplayStatusChromeBase.tsx'

import type { StatusChromeModel } from './DisplayStatusChromeBase.tsx'
import type {
  MouseState,
  MouseTracker,
} from '@jbrowse/core/ui/useMouseTracking'
import type { DisplayChromeOverlays } from '@jbrowse/display-ui'
import type { DisplayPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ComponentPropsWithRef, ReactNode } from 'react'

// What the chrome itself reads, on top of everything the overlays read
// (`StatusChromeModel`, composed from their own prop types in
// DisplayStatusChromeBase). (`renderError`/`setRenderError` are NOT here — they
// live on `RenderLifecycleModel`, always intersected in below.)
export type ChromeModel = {
  displayPhase: DisplayPhase
  height: number
  // `painted`, never the raw `canvasDrawn`: a display deliberately showing a
  // static placeholder instead of a canvas (sequence zoomed out, LD with the
  // triangle off) has finished, and the raw flag can never say so. See
  // `RenderLifecycleMixin.painted`.
  painted: boolean
} & StatusChromeModel

export interface CanvasHandle {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
  /**
   * The container-relative pointer position, published rather than held — read
   * it with `useMouseState(mouseTracker)` **in the body**, never beside the
   * chrome. The chrome binds the handlers itself precisely so that rule can't be
   * got wrong: there is no longer a position to hold up here.
   */
  mouseTracker: MouseTracker
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
// Everything after that (the container, the testid and its
// `data-display-drawn`, `data-display-phase`, the four remaining overlays) is
// shared verbatim with
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
// **Pointer tracking belongs to the chrome**, because the chrome owns the
// element the position is measured against. Nine displays used to call
// `useMouseTracking` themselves and wire three props, and the rule that keeps it
// cheap — publish the position, never hold it at this level — survived only as
// an identical comment copied into eight of them. Holding it here costs a whole
// display's chrome re-rendering because the cursor moved a pixel: this component
// (re-running `useRenderingBackend`), the status container with a fresh inline
// `style` object, all the overlays, and only then the body that wanted the
// coordinate. Now there is no position at this level to hold: `mouseTracker`
// goes out through the handle and the body reads it with `useMouseState`.
//
// A display that hit-tests as the cursor moves passes `onPointerPosition`, so
// its hit comes off the same single measurement as its guides. A display that
// needs the container node itself still passes a plain `ref` — maf, whose
// drag-selection resolves window-level drag coordinates against it — and gets
// it, because the measurement here reads `currentTarget` and holds no ref to
// collide with.
//
// `testid` names the display TYPE and never changes value. It used to gain a
// `-done` suffix once `canvasDrawn` flipped; ADR-065 removed that in favour of
// the `data-display-drawn` attribute the chrome publishes beside it, so a test
// waits on `[data-testid="x"][data-display-drawn="true"]` (the
// `displayPainted()` builder in @jbrowse/browser-test-utils writes it), then
// reads the canvas inside.
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
// Exported so `DisplayChrome` can bind `overlays` off it rather than restate it.
// It restated the list by hand until 2026-08, and that is exactly how the handle
// grew a `containerRef` no display ever read: declared here, copied there, and
// then only removable in two places at once.
export type DisplayChromeBaseProps<B> = {
  model: ChromeModel & RenderLifecycleModel<B>
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  children: (handle: CanvasHandle) => ReactNode
  testid: string
  overlays: DisplayChromeOverlays
  /**
   * Called with each measured pointer position (and `undefined` on leave), for
   * a display that hit-tests as the cursor moves. It runs off the same single
   * measurement the tracker publishes, so a display's hit and its guides can't
   * come from two different rects in two different frames.
   */
  onPointerPosition?: (state?: MouseState) => void
} & Omit<ComponentPropsWithRef<'div'>, 'children'>

function DisplayChromeBaseInner<B extends RenderingBackend>({
  model,
  factory,
  children,
  overlays,
  onPointerPosition,
  onMouseMove,
  onMouseLeave,
  ...chromeProps
}: DisplayChromeBaseProps<B>) {
  // eslint-plugin-react-compiler (react-compiler@19.1.0-rc.2) thinks this
  // directive is unused, but the babel plugin (@1.0.0, the real build) DOES
  // compile this fn — version skew. The directive is load-bearing; keep it.
  // eslint-disable-next-line react-compiler/react-compiler
  'use no memo'
  const { canvas, canvasRef, retry, canvasKey } = useRenderingBackend(
    factory,
    model,
  )
  // The chrome owns the pointer measurement, because it owns the element the
  // measurement is *against*. Every display used to do this itself — `useRef` +
  // `useMouseTracking` + three props, at nine call sites — and the rule that
  // keeps it cheap ("publish the position, don't hold it here") survived only as
  // an identical comment copied into eight files, with alignments having already
  // dropped `onMouseLeave`. Owning it makes the rule structural: there is no
  // position at this level to hold. The hook measures off `currentTarget`, so
  // the chrome needs no ref of its own and a caller's `ref` rides the spread
  // below untouched — nothing to merge, nothing to displace.
  const { mouseTracker, handleMouseMove, handleMouseLeave } =
    useMouseTracking(onPointerPosition)
  const phase = model.displayPhase
  // The two subtree-replacing phases remove the very element the handlers above
  // are bound to, and `mouseleave` cannot fire on an element unmounted under the
  // cursor — so without this the tracker keeps publishing the position the
  // pointer had when the banner went up. Nothing reads it while the banner is
  // there, which is exactly why it goes unnoticed: the body remounts the instant
  // the phase clears (Force load, Retry) and reads that stale snapshot on its
  // FIRST render, drawing a crosshair or tooltip where the cursor is not. The
  // displays whose pointer layer has no other gate — multi-row features, maf,
  // both multi-sample variant displays — draw it immediately. `onPointerPosition`
  // consumers (`hoveredFeature`, `hoveredFeature`) are pinned to the same
  // stale hit, and get their `undefined` from the same call.
  //
  // Declared above the `renderError` return because it is a hook; the handler is
  // identity-stable (see `useMouseTracking`) so this effect runs on the
  // transition rather than on every render.
  const containerMounted = phase !== 'renderError' && phase !== 'tooLarge'
  useEffect(() => {
    if (!containerMounted) {
      handleMouseLeave()
    }
  }, [containerMounted, handleMouseLeave])
  if (phase === 'renderError') {
    // destructured for the same reason as in DisplayStatusChromeBase: a plain
    // component-typed prop reads better as `<RenderError/>` than as a member
    // expression, and there is no observable here to stale
    const { RenderError } = overlays
    return (
      <RenderError
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
      // Composed, never replacing: a caller still binding its own pointer
      // handlers (maf's drag-selection, which owns a rubberband rect and a
      // window-level drag) would otherwise be silently overridden by the
      // measurement below — the handlers would just stop firing, with nothing
      // to see but a drag that no longer drags.
      onMouseMove={event => {
        handleMouseMove(event)
        onMouseMove?.(event)
      }}
      onMouseLeave={event => {
        handleMouseLeave()
        onMouseLeave?.(event)
      }}
      model={model}
      phase={phase}
      drawn={model.painted}
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
      <Fragment key={canvasKey}>
        {children({ canvasRef, canvas, mouseTracker })}
      </Fragment>
    </DisplayStatusChromeBase>
  )
}

// Deliberate, and the only one in the tree: the generic `<B>` infers through
// `observer` only from a named declaration. See the comment on
// DisplayChromeBaseInner and its `'use no memo'`, which is what keeps the
// compiled form safe.
// eslint-disable-next-line no-restricted-syntax
const DisplayChromeBase = observer(DisplayChromeBaseInner)

export default DisplayChromeBase
