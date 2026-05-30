import type { ComponentPropsWithRef, ReactNode } from 'react'

import { useRenderingBackend } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'

import type { RenderLifecycleModel } from '@jbrowse/core/util/useRenderingBackend'

interface ChromeModel {
  error: unknown
  reload: () => void
  loadingOverlayVisible: boolean
  statusMessage?: string
  regionTooLarge: boolean
  regionCannotBeRendered: () => ReactNode
  height: number
}

interface CanvasHandle {
  canvasRef: (node: HTMLCanvasElement | null) => void
  canvas: HTMLCanvasElement | null
}

// Single home for every GPU display's render lifecycle AND status chrome.
// DisplayChrome owns the backend hook (`useRenderingBackend`) and the three
// terminal states (render error, region-too-large, fetch-error + loading
// overlays), then hands the canvas down to its body via a render prop. A
// display can't show a canvas while skipping a terminal state, can't bury the
// hook somewhere the chrome can't see (the seam alignments drifted through),
// and there's nothing to forget — the only per-display variance left is the
// body, which is irreducible.
//
// The body is a function so callers pass `canvasRef`/`canvas` to wherever the
// canvas mounts. Return a *named observer component* from it (not inline JSX
// reading observables) so reactivity scopes to the body, not the chrome.
function DisplayChromeInner<B extends { dispose(): void }>({
  model,
  factory,
  children,
  ...divProps
}: {
  model: ChromeModel & RenderLifecycleModel<B>
  factory: (canvas: HTMLCanvasElement) => Promise<B>
  children: (handle: CanvasHandle) => ReactNode
} & Omit<ComponentPropsWithRef<'div'>, 'children'>) {
  const { canvas, canvasRef, error, retry } = useRenderingBackend(factory, model)
  if (error) {
    return (
      <DisplayRenderErrorOverlay
        error={error}
        onRetry={retry}
        height={model.height}
      />
    )
  }
  if (model.regionTooLarge) {
    return model.regionCannotBeRendered()
  }
  return (
    <div {...divProps}>
      {children({ canvasRef, canvas })}
      <DisplayErrorBar model={model} />
      <DisplayLoadingOverlay model={model} />
    </div>
  )
}

const DisplayChrome = observer(DisplayChromeInner)

export default DisplayChrome
