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

`DisplayChromeOverlays` is five components with fixed prop shapes, so a set is
an object literal: spread `plainChromeOverlays` and replace what you care about.
`TrackControlComponent` takes props that _describe_ the control: an icon name,
never an element.

Two obligations the types can't carry. The error bar and loading scrim mount
**unconditionally** and gate on `visible`, so a replacement can hold state
across a fetch. Every state must also offer its way out, `model.reload()`
included on the scrim's _canceled_ branch.

## Keeping MUI out of the bundle

Stock displays import `DisplayChrome` and `TrackControl` directly, so the
provider only changes what renders. MUI stays in your bundle. To keep it out of
the graph entirely, write your own display: `DisplayChromeBase` takes `overlays`
as a prop and imports no toolkit.
