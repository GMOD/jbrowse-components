import type { ComponentPropsWithRef, ReactNode } from 'react'

import { useRenderingBackend } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import TooLargeMessage from '../../shared/TooLargeMessage.tsx'

import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'

export interface ChromeModel {
  error: unknown
  renderError: unknown
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
// The body is a function so callers mount the canvas wherever it belongs. It
// returns a named observer component (every display does) so observable reads
// scope to the body rather than re-rendering the chrome. An outer hook bound to
// the chrome container (maf's drag-select, alignments' mouse tracking) stays in
// the caller and threads its state down as a prop.
//
// `testid` is the *base* first-paint selector; the chrome owns the `-done`
// convention, appending it once `canvasDrawn` flips, so no consumer hand-writes
// the ternary and the separator/gating can't drift. Tests wait on
// `${testid}-done`. (Canvas-pixel selectors like `hic_canvas_done` stay on the
// inner <canvas> — they target the element `expectCanvasMatch` reads, which the
// chrome div is not.)
function DisplayChromeInner<B extends { dispose(): void }>({
  model,
  factory,
  children,
  testid,
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
