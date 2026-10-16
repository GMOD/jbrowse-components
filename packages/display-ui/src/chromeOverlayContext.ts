import { createContext, use } from 'react'

import type { DisplayChromeOverlays } from './chromeOverlays.ts'

// The context alone, in a module of its own: the override channel must not live
// in the module that binds the default. `DisplayChrome.tsx` binds the Material
// set, so a provider imported from there put Material UI in the graph of the
// apps asking to leave it out. `muiFree.test.ts` fails naming the import trail
// if a toolkit-free module reaches `@mui/*` again.

/**
 * Runtime override for the overlay set. **Defaults to undefined, not to a
 * component set**: undefined means "nobody asked", so a display rendered
 * outside a provider (unit tests, SVG export) keeps JBrowse's own look.
 *
 * This is how an embedder makes JBrowse's own displays, which import
 * `DisplayChrome` directly, draw with their overlays: no MUI rendered, no
 * ThemeProvider needed, no emotion in their page.
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
 * supplies the default, so this module binds none.
 */
export function useChromeOverlayOverride() {
  return use(DisplayChromeOverlayContext)
}
