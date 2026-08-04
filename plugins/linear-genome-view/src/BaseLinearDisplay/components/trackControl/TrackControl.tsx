import { createContext, use } from 'react'

import MuiTrackControl from './MuiTrackControl.tsx'

import type { TrackControlComponent, TrackControlProps } from './types.ts'

/**
 * Runtime override for how ambient track controls are drawn. **Defaults to
 * undefined, not to a component** — the same choice `DisplayChromeOverlayProvider`
 * makes, for the same reason: a plain default would silently change the look of
 * every display that renders outside a provider (unit tests, SVG export,
 * breakpoint-split-view's overlayUtils), and that degradation is invisible.
 * Undefined means "nobody asked", so JBrowse keeps its own look.
 *
 * This is the corner-control half of the bring-your-own-UI story. The status
 * states (loading scrim, error bar, too-large gate) go through
 * `DisplayChromeOverlayProvider`; the controls a display draws for itself in its
 * bottom-right corner go through this one. Two providers because they are
 * rendered by two different things — the chrome renders the first set, the
 * display's own component renders the second — and folding them together would
 * put entries in `DisplayChromeOverlays` that `DisplayChromeBase` never uses.
 *
 * Pair with `plainTrackControl` for a dependency-free set:
 *
 * ```tsx
 * <DisplayChromeOverlayProvider value={plainChromeOverlays}>
 *   <TrackControlProvider value={plainTrackControl}>
 *     …your tracks…
 *   </TrackControlProvider>
 * </DisplayChromeOverlayProvider>
 * ```
 *
 * Like the overlay provider this is *reach*, not *weight*: `TrackControl` still
 * references `MuiTrackControl`, so Material UI stays in the bundle — it just
 * stops rendering. A display that wants it out of the module graph entirely
 * renders a `TrackControlComponent` of its own directly.
 */
const TrackControlContext = createContext<TrackControlComponent | undefined>(
  undefined,
)

export const TrackControlProvider = TrackControlContext.Provider

/**
 * What every display renders for a bottom-right control: JBrowse's own Material
 * UI look, unless a `TrackControlProvider` above it says otherwise.
 *
 * Not an `observer` — it reads no observables, it only picks an implementation
 * and forwards. Callers that read model state build their props in their own
 * observer, the way `DisplayChrome` leaves observation to the components around
 * it.
 */
export default function TrackControl(props: TrackControlProps) {
  const Control = use(TrackControlContext) ?? MuiTrackControl
  return <Control {...props} />
}
