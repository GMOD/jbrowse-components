import type { ComponentPropsWithRef, ReactNode } from 'react'

import { useRenderingBackend } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import TooLargeMessage from '../../shared/TooLargeMessage.tsx'

import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'

// `renderError`/`setRenderError` are NOT here — they live on
// `RenderLifecycleModel`, which the chrome's model is always intersected with.
// These are the fetch/region/status fields DisplayChrome reads itself or hands
// to its sub-overlays.
export interface ChromeModel {
  error: unknown
  reload: () => void
  forceLoad: () => void
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
// terminal-state UI, but the *states themselves* all live on the model:
// `renderError` (the hook writes it there), `regionTooLarge`, and the
// fetch-error + loading scrim (`loadingOverlayVisible`). The model is the
// single source of truth — `loadingOverlayVisible` accounts for all the others,
// so the four states are mutually exclusive by construction and the JSX order
// below is defensive, not load-bearing. A display can't show a canvas while
// skipping a terminal state, can't bury the hook somewhere the chrome can't see
// (the seam alignments drifted through), and there's nothing to forget — the
// only per-display variance left is the body, which is irreducible.
//
// The two terminal states (renderError, regionTooLarge) **early-return** their
// own component instead of nesting inside the container `<div>` below. This is
// load-bearing, not stylistic — it looks like a leak (caller className/ref/mouse
// handlers are absent in those states) but the leak is benign (a too-large
// region has no canvas to interact with; the ref re-attaches on force-load) and
// closing it reintroduces a real bug. Nesting (keep the container mounted, swap
// only its children) makes `regionTooLarge` THRASH: the canvas mounts while
// false -> the byte-estimate fetch flips it true -> the terminal branch unmounts
// the canvas -> the fetch system clears it back to false next tick -> the canvas
// remounts -> repeat forever (caught by StatsEstimation.test: DisplayChrome
// re-renders alternating true/false). Fully replacing the subtree keeps the
// canvas out of the tree across the whole too-large state — the ADR-025
// dispose/re-init contract, and what breaks the loop. Don't wrap these.
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
  if (model.renderError) {
    return (
      <DisplayRenderErrorOverlay
        error={model.renderError}
        onRetry={retry}
        height={model.height}
      />
    )
  }
  if (model.regionTooLarge) {
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
