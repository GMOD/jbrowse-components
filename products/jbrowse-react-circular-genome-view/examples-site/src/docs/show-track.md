To open a track in response to something at runtime — a button, a search hit, a
prop — call `showTrack` after construction rather than baking the trackId into
`init`. That needs the unmanaged `createViewState` flow, since the managed
`<CircularGenomeView>` reads its props once on mount:

```js
const s = createViewState({ assembly, tracks })
s.session.view.showTrack('volvox_sv_test')
```

For tracks that should be open on first paint, list them in the managed
component's [`init`](../volvox/) instead. The view's other actions are in the
[CircularView state model](https://jbrowse.org/jb2/docs/models/circularview/).
