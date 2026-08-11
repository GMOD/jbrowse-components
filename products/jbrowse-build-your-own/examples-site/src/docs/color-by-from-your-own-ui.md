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
schemes you name, in your order, from the same registry the track menu uses — so
your menu cannot drift from the schemes that exist, and a `type` that isn't one
fails to compile.

Read the value back off the model rather than keeping it in React state: the
track's own menu writes the same field, and so does a restored session.

`setColorScheme` over a bare `setConf` — it also clears the discovered per-read
values the CPU-baked schemes fill in, which a config write would leave stale.

## The legend is not yours

Tick **Show legend** and one appears — drawn by JBrowse, not by this file.
Unlike the loading and error states there is **no provider to swap it**: a
display renders its floating chrome directly. It is plain (no Material UI) and
the user can dismiss it.

A key lists the colours actually painted in the window, not every colour the
scheme could paint, so what it says moves with the data.

`showLegend` is off by default and is a _promotable_ slot, so read it through
`display.showLegend` rather than `getConf`: unset means "follow the session
default", and only the resolved getter knows what that came out as.

It renders inside the display's `contain: strict` box — its own stacking context
— so it cannot paint above anything you draw over the track stack. This page
draws no region seams, so nothing buries it.
