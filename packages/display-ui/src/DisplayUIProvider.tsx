import { useMemo } from 'react'

import { DisplayChromeOverlayProvider } from './chromeOverlayContext.ts'
import plainChromeOverlays from './plainChromeOverlays.tsx'
import plainTrackControl from './trackControl/plainTrackControl.tsx'
import { TrackControlProvider } from './trackControl/trackControlContext.ts'

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
 *
 * **`overlays` is a partial set**, merged over the plain one, so replacing a
 * single state is one entry rather than five:
 *
 * ```tsx
 * <DisplayUIProvider overlays={{ ErrorBar: MyErrorBar }}>
 * ```
 *
 * Partial rather than whole for two reasons. A host writing four of the five
 * states by hand only ever wanted one of them, and every example of this had
 * spread `plainChromeOverlays` in to say so. And a *sixth* state is a thing
 * JBrowse can add: with a whole set the host's object goes stale on upgrade —
 * a compile error if they typecheck, a missing component if they ship JS — while
 * a partial one keeps working and picks up the new plain default.
 *
 * Hold the object still (module scope, or `useMemo`) if you build one: it is a
 * context value, so a fresh identity each render re-renders every display
 * beneath.
 *
 * **The contexts themselves still default to `undefined`, and that stays true.**
 * A display rendering outside any provider — a unit test, the SVG export,
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
 * This module reaches no `@mui/*` module, and `muiFreeSeam.test.ts` keeps it
 * that way — asking for less Material UI must not download more of it. What it
 * cannot do is unship the Material components a *stock display* imports:
 * `DisplayChrome` and `TrackControl` are in that display's chunk either way,
 * and merely stop rendering. Keeping them out of the graph means writing your
 * own display component over `DisplayChromeBase`, which takes `overlays` as a
 * prop and imports no toolkit. See `agent-docs/reference/DISPLAYCHROME.md`.
 */
export default function DisplayUIProvider({
  overlays,
  trackControl = plainTrackControl,
  children,
}: {
  overlays?: Partial<DisplayChromeOverlays>
  trackControl?: TrackControlComponent
  children: ReactNode
}) {
  const resolved = useMemo(
    () => (overlays ? { ...plainChromeOverlays, ...overlays } : undefined),
    [overlays],
  )
  return (
    <DisplayChromeOverlayProvider value={resolved ?? plainChromeOverlays}>
      <TrackControlProvider value={trackControl}>
        {children}
      </TrackControlProvider>
    </DisplayChromeOverlayProvider>
  )
}
