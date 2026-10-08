import { useChromeOverlayOverride } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import DisplayBackgroundProgress from './DisplayBackgroundProgress.tsx'
import DisplayChromeBase from './DisplayChromeBase.tsx'
import DisplayErrorBar from './DisplayErrorBar.tsx'
import DisplayLoadingOverlay from './DisplayLoadingOverlay.tsx'
import DisplayRenderErrorOverlay from './DisplayRenderErrorOverlay.tsx'
import TooLargeMessage from './TooLargeMessage.tsx'

import type { DisplayChromeBaseProps } from './DisplayChromeBase.tsx'
import type { DisplayChromeOverlays } from '@jbrowse/display-ui'
import type { RenderingBackend } from '@jbrowse/render-core/renderingBackendBase'

export type { ChromeModel } from './DisplayChromeBase.tsx'

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

// The context lives in `chromeOverlayContext.ts` and not here: this module
// binds the Material set above, so anything importing the provider from here
// would pull all of Material UI in on the way to asking for less of it.
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
 */
const DisplayChrome = observer(function DisplayChrome<
  B extends RenderingBackend,
>(props: Omit<DisplayChromeBaseProps<B>, 'overlays'>) {
  return <DisplayChromeBase {...props} overlays={useChromeOverlays()} />
})

export default DisplayChrome
