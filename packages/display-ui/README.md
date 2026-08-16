# @jbrowse/display-ui

The UI a display draws that is **not data** — loading scrims, error bars, the
too-large gate, the controls in a track's corner, and the overlay layer floating
chrome escapes into. The contract, and implementations of it that reach no UI
toolkit.

```tsx
import { DisplayUIProvider } from '@jbrowse/display-ui'

;<DisplayUIProvider>{tracks}</DisplayUIProvider>
```

That is the whole common case: JBrowse's own stock displays render no Material
UI beneath it, with no `ThemeProvider` to mount and no emotion in your page.
Supply `overlays` (a partial set, merged over the plain one) or `trackControl`
to bring your own.

## Why it is a package

**This package has no UI-toolkit dependency, and that is the feature.** The
contract used to live beside the Material implementations it exists to replace,
so importing the seam pulled 45 `@mui/*` modules in behind it — the whole
Material overlay set, and (through one barrel import) `FileSelector`,
`FatalErrorDialog` and `PluginManager`. Every check in the repo counted
_rendered_ elements and stayed green. Here, npm decides instead of a test: the
Material bindings live in `@jbrowse/plugin-linear-genome-view`, which depends on
this, never the other way round.

It also puts the contract somewhere `packages/*` can reach. `tree-sidebar`
depended on the LGV **plugin** for `TrackOverlayPortal` alone; the comparative
displays could not read the overlay contract at all, because it sat one layer
above them.

## What is here

|                                             |                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `DisplayChromeOverlays`                     | the five `displayPhase` states, as a component set, with the model shape each is handed |
| `DisplayChromeOverlayProvider`              | redirects those states for JBrowse's own displays                                       |
| `TrackControlComponent`                     | one shape for every ambient bottom-right control, icons named rather than passed        |
| `TrackControlProvider`                      | redirects those                                                                         |
| `DisplayUIProvider`                         | both at once, defaulting to the plain sets — what an embedder mounts                    |
| `plainChromeOverlays` / `plainTrackControl` | the toolkit-free sets, CSS system colours, no theme object                              |
| `TrackOverlaySlot` / `TrackOverlayPortal`   | the per-track overlay layer, and the host's half of it                                  |
| `tooLargeBannerText`                        | what the byte gate says, shared by every set that renders it                            |

## What is _not_ here, and cannot be

Redirecting what a stock display **renders** is not the same as keeping a
toolkit out of its **bundle**. `DisplayChrome` and `TrackControl` live in the
LGV plugin and import Material UI; a provider only stops them rendering it.
Dropping the weight means writing your own display component over
`DisplayChromeBase`, which takes `overlays` as a prop.

See `agent-docs/reference/DISPLAYCHROME.md` for the seams in full, and
`products/jbrowse-build-your-own` for a site built on them.
