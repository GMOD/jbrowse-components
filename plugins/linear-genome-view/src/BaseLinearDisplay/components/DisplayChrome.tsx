import { createContext, use } from 'react'

import TooLargeMessage from '../../shared/TooLargeMessage.tsx'
import DisplayBackgroundProgress from './DisplayBackgroundProgress.tsx'
import DisplayChromeBase from './DisplayChromeBase.tsx'
import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'

import type { ChromeModel } from './DisplayChromeBase.tsx'
import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type { ChromeModel } from './DisplayChromeBase.tsx'

// The MUI overlay set, and the only reason MUI is a dependency of a display's
// startup path (measured: ~165KB of the eager bundle, essentially all of it
// `DisplayLoadingOverlay` -> core/ui `LoadingOverlay` -> Tooltip/IconButton).
// Module-scope so the object identity is stable across renders.
const muiOverlays: DisplayChromeOverlays = {
  RenderError: DisplayRenderErrorOverlay,
  TooLarge: TooLargeMessage,
  ErrorBar: DisplayErrorBar,
  Loading: DisplayLoadingOverlay,
  BackgroundProgress: DisplayBackgroundProgress,
}

/**
 * Runtime override for the overlay set. **Defaults to undefined, not to a
 * component set** — that is deliberate. A plain default would silently degrade
 * every display that renders outside a provider (unit tests, SVG export,
 * breakpoint-split-view's overlayUtils), and that degradation is invisible: the
 * display still works, it just stops looking like JBrowse. Undefined means
 * "nobody asked", so `DisplayChrome` keeps its MUI set and nothing changes.
 *
 * This is the escape hatch for embedders who want JBrowse's *own* displays
 * (wiggle, alignments, variants — all of which import `DisplayChrome` directly
 * and so can't be redirected at the import level) to draw with their overlays:
 * no MUI rendered, no ThemeProvider needed, no emotion in their page. MUI still
 * lands in the bundle, because `DisplayChrome` references it above.
 *
 * To also drop MUI from the bundle you need the other seam: import
 * `DisplayChromeBase` and pass `overlays` as a prop, which is only available to
 * code writing its own display component. Two mechanisms because they solve
 * different halves — this one is reach, that one is weight.
 */
const DisplayChromeOverlayContext = createContext<
  DisplayChromeOverlays | undefined
>(undefined)

export const DisplayChromeOverlayProvider =
  DisplayChromeOverlayContext.Provider

/**
 * The chrome every in-tree GPU/Canvas2D display renders: `DisplayChromeBase`
 * with JBrowse's own MUI overlays bound in, unless a
 * `DisplayChromeOverlayProvider` above it says otherwise.
 *
 * All the behavior lives in `DisplayChromeBase` — see that file for the
 * `displayPhase` contract, the subtree-replacing terminal states, and the
 * canvas dispose/re-init lifecycle.
 *
 * Not an `observer`: it reads no observables, it only picks an overlay set and
 * forwards. The generic `<B>` threads through to `DisplayChromeBase`, which is
 * the observer.
 */
export default function DisplayChrome<B extends { dispose(): void }>(
  props: {
    model: ChromeModel & RenderLifecycleModel<B>
    factory: (canvas: HTMLCanvasElement) => Promise<B>
    children: (handle: {
      canvasRef: (node: HTMLCanvasElement | null) => void
      canvas: HTMLCanvasElement | null
    }) => ReactNode
    testid?: string
  } & Omit<ComponentPropsWithRef<'div'>, 'children'>,
) {
  const override = use(DisplayChromeOverlayContext)
  return <DisplayChromeBase {...props} overlays={override ?? muiOverlays} />
}
