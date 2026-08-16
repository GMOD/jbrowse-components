A track draws more than data: states (fetching, failed, region too large, GPU
gave up) and a corner control, all Material UI by default. That is the single
biggest reason embedding a track drags a UI toolkit into your app.

They are swappable. Above are JBrowse's stock displays, unforked, drawing their
states three ways: a set written in this file, the plain set JBrowse ships, and
the Material default. The third track's URL does not exist, so it holds its
error state.

```tsx
<DisplayUIProvider>{tracks}</DisplayUIProvider>
<DisplayUIProvider overlays={myOverlays}>{tracks}</DisplayUIProvider>
```

`DisplayChromeOverlays` is five components with fixed prop shapes, and
`overlays` takes a **partial** set merged over the plain one, so replacing a
single state is one entry rather than five. `TrackControlComponent` takes props
that _describe_ the control: an icon name, never an element — and
`useTrackControlMenu` hands you the menu behaviour behind it (dismissal, focus,
the top layer, the anchoring) if you would rather write your own markup than
restyle the plain one.

Two obligations the types can't carry. The error bar and loading scrim mount
**unconditionally** and gate on `visible`, so a replacement can hold state
across a fetch. Every state must also offer its way out, `model.reload()`
included on the scrim's _canceled_ branch.

## Keeping MUI out of the bundle

All of the above is `@jbrowse/display-ui`, which depends on no UI toolkit — so
asking for the plain look does not download the Material one on the way. That is
worth stating because it was not true until 2026-08: the contract shared a
module with the implementations it replaces, and this page carried twice the
Material UI of the page that keeps Material on screen.

What the package cannot do is unship what a _display_ imports. Stock displays
import `DisplayChrome` and `TrackControl` directly, so a provider only changes
what renders, and MUI stays in your bundle. To keep it out of the graph
entirely, write your own display: `DisplayChromeBase` takes `overlays` as a prop
and imports no toolkit.
