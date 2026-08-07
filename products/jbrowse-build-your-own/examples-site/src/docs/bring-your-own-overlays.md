A track draws more than data. It has states — fetching, failed, region too
large, GPU gave up — and a corner control of its own, all Material UI by
default: the single biggest reason embedding a track drags a UI toolkit into
your app.

They are swappable. Above are JBrowse's stock displays, unforked, drawing their
states three ways — a set written in this file, the plain set JBrowse ships, and
the Material default. The third track's URL does not exist, so it holds its
error state while you compare.

```tsx
<DisplayUIProvider>{tracks}</DisplayUIProvider>
<DisplayUIProvider overlays={myOverlays}>{tracks}</DisplayUIProvider>
```

Bare, both sets are plain and toolkit-free; `overlays` and `trackControl` take
your own. Two contexts underneath, one provider over them — you always want
both.

## Writing your own set

`DisplayChromeOverlays` is five components with fixed prop shapes, so a set is
an object literal — spread `plainChromeOverlays` and replace what you care
about. `TrackControlComponent` takes props that _describe_ the control, an icon
**name** and never an element, or every display imports an icon set again.

Two obligations the types can't carry: the error bar and loading scrim mount
**unconditionally** and gate on the `visible` prop, which is what lets a
replacement hold state across a fetch; and every state must offer its way out —
`model.reload()`, including on the scrim's _canceled_ branch, since a canceled
fetch is deliberately durable. Keep the plain set's `data-testid` values and
JBrowse's own suites run against yours.

## Reach, and weight

Stock displays import `DisplayChrome` and `TrackControl` directly, so the
provider is how you reach them — MUI stays in your bundle, but nothing on screen
renders it. To keep it out of the graph entirely, write your own display:
`DisplayChromeBase` takes `overlays` as a prop and imports no toolkit. Avoid
`makeStyles` from `@jbrowse/core/util/tss-react` there — it reads the MUI theme.
