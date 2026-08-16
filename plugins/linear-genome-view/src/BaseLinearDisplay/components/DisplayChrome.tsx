import TooLargeMessage from '../../shared/TooLargeMessage.tsx'
import DisplayBackgroundProgress from './DisplayBackgroundProgress.tsx'
import DisplayChromeBase from './DisplayChromeBase.tsx'
import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import DisplayStatusChromeBase from './DisplayStatusChromeBase.tsx'
import { useChromeOverlayOverride } from './chromeOverlayContext.ts'

import type { DisplayChromeBaseProps } from './DisplayChromeBase.tsx'
import type { DisplayStatusChromeBaseProps } from './DisplayStatusChromeBase.tsx'
import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'

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

// Both binders resolve the set the same way, so a provider redirects the
// backend-free displays (arc) exactly as it does the GPU ones.
//
// The context itself lives in `chromeOverlayContext.ts` and NOT here, which is
// load-bearing rather than tidiness: this module binds the Material set above,
// so anything importing the provider from here would pull all of Material UI in
// on the way to asking for less of it. See that file.
function useChromeOverlays() {
  return useChromeOverlayOverride() ?? muiOverlays
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
export default function DisplayChrome<B extends RenderingBackend>(
  // The base's own props minus the one thing this file supplies. Restating the
  // list here is how the render-prop handle grew a `containerRef` no display
  // ever read: declared on `CanvasHandle`, copied into a second inline shape
  // here, and then removable only in two places at once.
  props: Omit<DisplayChromeBaseProps<B>, 'overlays'>,
) {
  return <DisplayChromeBase {...props} overlays={useChromeOverlays()} />
}

/**
 * The same chrome for a display with **no rendering backend** — arc's
 * main-thread SVG. Identical container, testid, `data-display-phase`
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
  props: Omit<DisplayStatusChromeBaseProps, 'overlays'>,
) {
  return <DisplayStatusChromeBase {...props} overlays={useChromeOverlays()} />
}
