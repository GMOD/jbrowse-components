import { DisplayChromeOverlayProvider } from './chromeOverlayContext.ts'
import plainChromeOverlays from './plainChromeOverlays.tsx'
import plainTrackControl from './trackControl/plainTrackControl.tsx'
import { TrackControlProvider } from './trackControl/trackControlContext.ts'

import type { DisplayChromeOverlays } from './chromeOverlays.ts'
import type { TrackControlComponent } from './trackControl/types.ts'
import type { ReactNode } from 'react'

// One merged set per caller's object, for the life of that object.
//
// The value goes into a context, so a fresh identity on each render re-renders
// every display beneath it — and `observer()` wraps `React.memo`, so a new
// `overlays` prop defeats the memo on each display's whole chrome. Stability is
// the point; the allocation is nothing.
//
// A `useMemo` would do it and is worse in three small ways: it is per component
// *instance*, so two providers handed the same set produce two identities and
// two re-render groups; React may discard the cache; and it makes a plain
// merge into a hook, unusable from a test or a caller building the value by
// hand. Keyed weakly, so an inline literal — which misses either way — is
// collected rather than accumulated.
const merged = new WeakMap<
  Partial<DisplayChromeOverlays>,
  DisplayChromeOverlays
>()

export function resolveOverlays(overlays?: Partial<DisplayChromeOverlays>) {
  // the common case allocates nothing: no argument means the plain set itself,
  // which is already a module constant
  if (!overlays) {
    return plainChromeOverlays
  }
  let full = merged.get(overlays)
  if (!full) {
    full = { ...plainChromeOverlays, ...overlays }
    merged.set(overlays, full)
  }
  return full
}

/**
 * #api
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
 * Declare that object at module scope if you can. The merge is stable per
 * object (`resolveOverlays`), so a constant costs one merge for the life of the
 * app; a literal written inline in JSX is a new object every render, and this
 * value goes into a context, so every display beneath re-renders with it.
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
 * it arrives through `SessionPaletteProvider`
 * (`@jbrowse/core/ui/PaletteContext`) whatever these are set to. A feature track
 * needs it even with plain chrome.
 *
 * This module reaches no `@mui/*` module, and `muiFree.test.ts` keeps it
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
  return (
    <DisplayChromeOverlayProvider value={resolveOverlays(overlays)}>
      <TrackControlProvider value={trackControl}>
        {children}
      </TrackControlProvider>
    </DisplayChromeOverlayProvider>
  )
}
