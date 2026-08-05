import { createContext, use } from 'react'

import TooLargeMessage from '../../shared/TooLargeMessage.tsx'
import DisplayBackgroundProgress from './DisplayBackgroundProgress.tsx'
import DisplayChromeBase from './DisplayChromeBase.tsx'
import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import DisplayStatusChromeBase from './DisplayStatusChromeBase.tsx'

import type { ChromeModel } from './DisplayChromeBase.tsx'
import type { StatusChromeModel } from './DisplayStatusChromeBase.tsx'
import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'
import type { ComponentPropsWithRef, ReactNode } from 'react'

export type { ChromeModel } from './DisplayChromeBase.tsx'
export type { StatusChromeModel } from './DisplayStatusChromeBase.tsx'

// The MUI overlay set, and the only reason MUI is a dependency of a display's
// startup path. `pnpm measure-chrome-bundle` bundles this file and the
// base+plain pairing separately and writes scripts/chromeBundleSizes.json; CI
// re-checks it, so that file is the current cost, not a number in a comment.
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

export const DisplayChromeOverlayProvider = DisplayChromeOverlayContext.Provider

// Both binders resolve the set the same way, so a provider redirects the
// backend-free displays (arc) exactly as it does the GPU ones.
function useChromeOverlays() {
  return use(DisplayChromeOverlayContext) ?? muiOverlays
}

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
    testid: string
  } & Omit<ComponentPropsWithRef<'div'>, 'children'>,
) {
  return <DisplayChromeBase {...props} overlays={useChromeOverlays()} />
}

/**
 * The same chrome for a display with **no rendering backend** — arc's
 * main-thread SVG. Identical container, `-done` testid, `data-display-phase`
 * and overlays; it just takes the phase and the first-paint flag as props
 * instead of reading them off a `RenderLifecycleMixin`, and offers no
 * `renderError` banner because there is no backend to fail (hence
 * `DisplayStatusPhase`, which cannot name that state).
 *
 * A backend-less display should render this rather than assembling banners
 * itself: doing it by hand is what let arc drift into showing no
 * background-progress chip. Not an `observer` — like `DisplayChrome` it only
 * picks an overlay set and forwards; the caller reading `model.displayPhase`
 * is the observer.
 */
export function DisplayStatusChrome(
  props: {
    model: StatusChromeModel
    phase: DisplayStatusPhase
    drawn: boolean
    testid: string
    children?: ReactNode
  } & Omit<ComponentPropsWithRef<'div'>, 'children'>,
) {
  return <DisplayStatusChromeBase {...props} overlays={useChromeOverlays()} />
}
