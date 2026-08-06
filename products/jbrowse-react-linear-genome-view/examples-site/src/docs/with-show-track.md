`state.session.view.showTrack('my-track-id')` opens a track in response to
something at runtime — a button, a search hit, a prop — rather than at first
mount. `hideTrack` is its counterpart. For tracks that should be open on first
paint, list them in [`init`](../setting-up-the-view/#with-init) instead.

For a track that isn't in the `tracks` config at all (a file the user just
picked, a hit from your own search service), register its config on the session
first:

```js
state.session.addTrackConf(trackConf)
state.session.view.showTrack(trackConf.trackId)
```

`addTrackConf` takes the same shape as the `tracks` prop, dedupes by `trackId`,
and is what the built-in "add track" form uses. Session-added tracks round-trip
through [saved sessions](../session-setup/#with-session-persistence).
