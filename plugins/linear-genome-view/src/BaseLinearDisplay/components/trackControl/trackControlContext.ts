import { createContext, use } from 'react'

import type { TrackControlComponent } from './types.ts'

// The context alone, apart from `MuiTrackControl` — the same split
// `chromeOverlayContext.ts` makes, for the reason written there: an override
// channel that lives in the module binding the default drags the default in
// with it, and no DOM census can see that.

/**
 * Runtime override for how ambient track controls are drawn. **Defaults to
 * undefined, not to a component** — the same choice the overlay context makes,
 * for the same reason: a plain default would silently change the look of every
 * display that renders outside a provider (unit tests, SVG export,
 * breakpoint-split-view's overlayUtils), and that degradation is invisible.
 * Undefined means "nobody asked", so JBrowse keeps its own look.
 *
 * This is the corner-control half of the bring-your-own-UI story; the status
 * states (loading scrim, error bar, too-large gate) go through the overlay
 * context. Two contexts because two different things render them — the chrome
 * renders the status states, the display's own component renders the controls —
 * and folding them together would put entries in `DisplayChromeOverlays` that
 * `DisplayChromeBase` never uses. `DisplayUIProvider` mounts both, which is what
 * an embedder actually wants.
 */
const TrackControlContext = createContext<TrackControlComponent | undefined>(
  undefined,
)

export const TrackControlProvider = TrackControlContext.Provider

/**
 * The component a provider installed, or `undefined` for "nobody asked". The
 * caller supplies the default, which is what keeps this module free of one.
 */
export function useTrackControlOverride() {
  return use(TrackControlContext)
}
