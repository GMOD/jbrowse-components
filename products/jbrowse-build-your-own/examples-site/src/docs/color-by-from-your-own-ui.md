The pages before this one drive the **view**. A display has settings of its own,
and they are the same kind of API: a getter to read, an action to write.

```tsx
display.colorBy.type // 'strand'
display.setColorScheme({ type: 'pairOrientation' })
display.setFeatureHeight(7)
```

`activeDisplay` is resolved at runtime, so assert it to the published
`LinearAlignmentsDisplayModel` to type those members.

**Take the labels from `pickColorOptions`.** It returns `{type, label}` for the
schemes you name, in your order, from the registry the track menu uses — so your
menu cannot drift, and a `type` that isn't a scheme fails to compile.

`setColorScheme` over a bare `setConf` — it also clears the discovered per-read
values the CPU-baked schemes fill in, which a config write would leave stale.

## The legend is not yours

Tick **Show legend** and one appears, drawn by JBrowse. Unlike the loading and
error states there is **no provider to swap it**: a display renders its floating
chrome directly. It is plain, and dismissable.

A key lists the colours actually painted in the window, not every colour the
scheme could paint, so it moves with the data.

`showLegend` is off by default and is a _promotable_ slot, so read
`display.showLegend` rather than `getConf`: unset means "follow the session
default", and only the resolved getter knows what that is.

## Getting it above your own overlays

The legend renders inside the display's `contain: strict` box, its own stacking
context, so it cannot out-`zIndex` the region seams this page draws over the
stack. `TrackOverlaySlot` is the way out, and it is what JBrowse's own track
container mounts: an overlay node _beside_ the sandbox, so chrome portalling
into it paints at the slot's `zIndex`. That prop has no default — it answers
"above what?", which is a fact about your layout.
