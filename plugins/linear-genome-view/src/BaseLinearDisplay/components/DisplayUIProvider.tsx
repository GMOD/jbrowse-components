import { DisplayChromeOverlayProvider } from './DisplayChrome.tsx'
import plainChromeOverlays from './plainChromeOverlays.tsx'
import { TrackControlProvider } from './trackControl/TrackControl.tsx'
import plainTrackControl from './trackControl/plainTrackControl.tsx'

import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { TrackControlComponent } from './trackControl/types.ts'
import type { ReactNode } from 'react'

/**
 * Both bring-your-own seams at once: what a display draws that is not data.
 *
 * There are two contexts underneath because two different things render them —
 * the chrome around a display draws the status states, the display itself draws
 * its bottom-right controls — and that split is real at the implementation
 * level, since `DisplayChromeBase` takes its overlay set as a *prop* and never
 * renders a track control. It is not real for an embedder: nobody wants stock
 * Material loading scrims with plain corner controls, or the reverse. Every
 * consumer in this repo mounts the two together.
 *
 * ```tsx
 * <DisplayUIProvider>{tracks}</DisplayUIProvider>
 * ```
 *
 * Both props default to the plain, toolkit-free sets, so the common case — "I
 * do not want Material UI in my app" — needs no arguments and no second import.
 * Supply either to bring your own:
 *
 * ```tsx
 * <DisplayUIProvider overlays={{ ...plainChromeOverlays, ErrorBar: MyErrorBar }}>
 * ```
 *
 * **The contexts still default to `undefined`, and that stays true.** A display
 * rendering outside any provider — a unit test, the SVG export,
 * breakpoint-split-view's `overlayUtils` — keeps JBrowse's own Material look,
 * because a plain ambient default would degrade those invisibly. Defaulting
 * *this component's props* is a different thing: mounting it is a deliberate
 * act, and the act means "not the Material default". Nothing gets a plain set
 * without someone having asked.
 *
 * Colors are not a seam and are not here. A display reads `usePalette()` for its
 * own content colors, which is a palette of strings rather than a UI toolkit, so
 * it arrives through `PaletteProvider` (`@jbrowse/core/ui/PaletteContext`)
 * whatever these are set to. A feature track needs it even with plain chrome.
 *
 * This is *reach*, not *weight*: stock displays import `DisplayChrome` and
 * `TrackControl` directly, so Material UI stays in the bundle and merely stops
 * rendering. Keeping it out of the module graph means writing your own display
 * component over `DisplayChromeBase`, which takes `overlays` as a prop and
 * imports no toolkit. See `agent-docs/reference/DISPLAYCHROME.md`.
 */
export default function DisplayUIProvider({
  overlays = plainChromeOverlays,
  trackControl = plainTrackControl,
  children,
}: {
  overlays?: DisplayChromeOverlays
  trackControl?: TrackControlComponent
  children: ReactNode
}) {
  return (
    <DisplayChromeOverlayProvider value={overlays}>
      <TrackControlProvider value={trackControl}>
        {children}
      </TrackControlProvider>
    </DisplayChromeOverlayProvider>
  )
}
