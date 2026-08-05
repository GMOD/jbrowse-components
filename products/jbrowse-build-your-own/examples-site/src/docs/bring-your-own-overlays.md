A track draws more than data. It has states — fetching, failed, region too large
to load, GPU gave up — and controls of its own in the bottom-right corner. By
default all of those are Material UI, and they are the single biggest reason
embedding a track drags a UI toolkit into your app.

They are swappable. The demo below is JBrowse's own stock wiggle, feature and
alignments displays, unforked, rendering **no Material UI at all** — toggle the
checkbox to compare. The third track points at a URL that does not exist, so it
holds still in its error state while you look.

```tsx
<DisplayChromeOverlayProvider value={plainChromeOverlays}>
  <TrackControlProvider value={plainTrackControl}>
    {tracks}
  </TrackControlProvider>
</DisplayChromeOverlayProvider>
```

`DisplayChromeOverlayProvider` replaces the five components that draw the status
states. `TrackControlProvider` replaces the one that draws an ambient corner
control — the track-sizing button, the isoform-collapse notice, the show-only
badge. Two providers rather than one because two different things render them:
the chrome around a display draws the first set, the display's own component
draws the second.

## Reach, and weight

Every stock display imports `DisplayChrome` and `TrackControl` directly, so you
cannot redirect them at the import level; the providers are how you reach them.
Material UI still ends up in your bundle, because those two modules reference
it, but nothing on screen renders it.

To keep it out of the module graph entirely, write your own display component:
import `DisplayChromeBase` and pass `overlays` as a prop, and render your own
`TrackControlComponent` directly. Neither imports a toolkit. Avoid `makeStyles`
from `@jbrowse/core/util/tss-react` there — it reads the Material UI theme,
which puts the toolkit straight back.

Swapping both sets removes Material UI _components_, not the _palette_.
JBrowse's stock displays read one to colour their own content: the feature
display reads `highlight`, the CDS renderer reads `framesCDS`. That arrives
through `PaletteProvider`, as the source below does, carrying a plain object of
colour strings from `resolvePalette` rather than a theme object.

## Writing your own sets

`DisplayChromeOverlays` is five components with fixed prop shapes.
`TrackControlComponent` is one, taking a `TrackControlProps` that describes the
control rather than drawing it — an icon _name_ (never an element, or every
display would import an icon set again), a tooltip, an optional label, and
either a list of options or a click handler.

`plainChromeOverlays` and `plainTrackControl` are dependency-free reference
implementations to read, copy, or write your own against. Two details in
`plainTrackControl` worth stealing rather than rediscovering: its menu is
portaled to `document.body` and positioned `fixed`, because these controls sit
on a display's bottom edge inside a `contain: strict` box that would otherwise
clip it; and it anchors the menu's _bottom_ to the trigger's top, so it opens
upward without anyone having to measure its height.

The `data-testid` values in the plain sets (`loading-overlay`,
`loading-overlay-cancel`, `loading-overlay-retry`, `progress-chip`,
`reload_button`, `use_canvas2d_button`, `track-control-dismiss`) are a contract
JBrowse's own test suites key on. Keep them if you want those suites to run
against your set.
