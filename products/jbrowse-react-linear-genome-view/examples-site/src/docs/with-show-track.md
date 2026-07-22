When tracks need to open in response to runtime conditions (a button click, a
search hit, a parent component prop) rather than at first mount, use the
imperative `showTrack` action:

```js
state.session.view.showTrack('my-track-id')
```

This composes naturally with React state. Call it from an event handler or an
effect. For tracks you want open on first paint instead, list their trackIds in
the [`init`](../setting-up-the-view/#with-init) field. `showTrack` is also the
way to layer a heavy track (e.g. a CRAM alignments track) on top of an existing
`init` session. See the [human exome example](../human-exome-example/).

`showTrack` (and its counterpart `hideTrack`) are documented in the
[LinearGenomeView state model](https://jbrowse.org/jb2/docs/models/lineargenomeview/).

For a track that isn't in the `tracks` config at all (a file the user just
picked, a hit from your own search service, a URL pasted into a form), register
its config on the session first, then show it:

```js
state.session.addTrackConf(trackConf)
state.session.view.showTrack(trackConf.trackId)
```

`addTrackConf` takes the same config shape as the `tracks` prop, dedupes by
`trackId`, and is the path the built-in "add track" form uses. Session-added
tracks round-trip through
[saved sessions](../session-setup/#with-session-persistence).
