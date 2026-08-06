`addTrackConf` registers a track config on a running app and `showTrack` opens
it — from an event handler, not during render:

```js
state.jbrowse.addTrackConf(trackConf)
state.session.views[0]?.showTrack(trackConf.trackId)
```

The slots a track config accepts are per type under
[docs/config](https://jbrowse.org/jb2/docs/config/), and each `adapter` type has
its own page. To add new track types, adapters or renderers rather than tracks,
see [plugins](../plugins/#embedded-plugin).
