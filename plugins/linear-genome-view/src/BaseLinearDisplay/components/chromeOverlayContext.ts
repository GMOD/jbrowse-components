import { createContext, use } from 'react'

import type { DisplayChromeOverlays } from './chromeOverlays.ts'

// The context alone, in a module of its own, so that consuming the seam does not
// import the thing the seam exists to replace.
//
// `DisplayChrome.tsx` is where the Material set is bound, and it used to hold
// this `createContext` too. That put 45 `@mui/*`-importing modules one hop from
// `DisplayUIProvider` — the component whose whole purpose is "I do not want
// Material UI in my app" — and the build agreed: the build-your-own site's
// "Removing Material UI" page carried 34 first-party eager modules importing
// `@mui/material` against 16 on the page that deliberately leaves the Material
// chrome on screen, and 53 KB gzip more. Nothing rendered them. A DOM census
// cannot see a module graph, so nothing said so.
//
// The rule that falls out, and it applies to any seam: **the override channel
// must not live in the module that binds the default.** Everything toolkit-free
// (`plainChromeOverlays`, `plainTrackControl`, `DisplayChromeBase`,
// `DisplayUIProvider`) reaches zero `@mui/*` modules, and
// `muiFreeSeam.test.ts` fails naming the import trail if that stops being true.

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
 * no MUI rendered, no ThemeProvider needed, no emotion in their page.
 *
 * Prefer `DisplayUIProvider`, which mounts this and the track-control context
 * together and accepts a partial set. Reach for this one only to override
 * exactly one of the two seams.
 */
const DisplayChromeOverlayContext = createContext<
  DisplayChromeOverlays | undefined
>(undefined)

export const DisplayChromeOverlayProvider = DisplayChromeOverlayContext.Provider

/**
 * The set a provider installed, or `undefined` for "nobody asked". The caller
 * supplies the default, which is what keeps this module free of one.
 */
export function useChromeOverlayOverride() {
  return use(DisplayChromeOverlayContext)
}
