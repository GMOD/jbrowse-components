A track draws more than data. It has states — fetching, failed, region too large
to load, GPU gave up — and controls of its own in the bottom-right corner. By
default all of those are Material UI, and they are the single biggest reason
embedding a track drags a UI toolkit into your app.

They are swappable. The demo above is JBrowse's own stock wiggle, feature and
alignments displays, unforked, drawing their states three ways: a set written in
the example file, the plain set JBrowse ships, and the Material default. The
third track points at a URL that does not exist, so it holds still in its error
state while you compare them.

```tsx
<DisplayChromeOverlayProvider value={myOverlays}>
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

## Writing your own set

`DisplayChromeOverlays` is five components with fixed prop shapes, so a set is
an object literal: spread `plainChromeOverlays` and replace what you care about,
as the source above does for the loading and error states.
`TrackControlComponent` is one more, taking props that _describe_ the control —
an icon **name**, never an element, or every display would import an icon set
again.

Two obligations the types can't carry. The error bar and the loading scrim are
mounted **unconditionally** and decide for themselves whether to draw, which is
what lets a replacement hold state across a fetch — an anti-flash delay, an
animation. And every state has to offer its way out: `model.reload()` on the
error bar, and `reload` again on the loading scrim's _canceled_ branch, since a
canceled fetch is deliberately durable and nothing else restarts it.

The `data-testid` values in the plain set (`loading-overlay`,
`loading-overlay-cancel`, `loading-overlay-retry`, `progress-chip`,
`reload_button`, `use_canvas2d_button`, `track-control-dismiss`) are a contract
JBrowse's own test suites key on. Keep them and those suites run against your
set too.

## Reach, and weight

Every stock display imports `DisplayChrome` and `TrackControl` directly, so you
cannot redirect them at the import level; the providers are how you reach them.
Material UI still ends up in your bundle, because those two modules reference
it, but nothing on screen renders it.

To keep it out of the module graph entirely, write your own display component:
import `DisplayChromeBase` and pass `overlays` as a prop, and render your own
`TrackControlComponent`. Neither imports a toolkit. Avoid `makeStyles` from
`@jbrowse/core/util/tss-react` there — it reads the Material UI theme, which
puts the toolkit straight back.

Swapping both sets removes Material UI _components_, not the _palette_.
JBrowse's stock displays read one to colour their own content: the feature
display reads `highlight`, the CDS renderer reads `framesCDS`. That arrives
through `PaletteProvider`, carrying a plain object of colour strings from
`resolvePalette` rather than a theme object.
