When tracks need to open in response to runtime conditions (a button click, a
search hit, a parent component prop) rather than at first mount, use the
imperative `showTrack` action:

```js
state.session.view.showTrack('my-track-id')
```

This composes naturally with React state — call it from an event handler or an
effect. For tracks you want open on first paint instead, list their trackIds in
the [`init`](../with-init/) field. `showTrack` is also the way to layer a heavy
track (e.g. a CRAM alignments track) on top of an existing `init` session — see
the [human exome example](../human-exome-example/).
