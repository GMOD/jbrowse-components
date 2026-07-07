When a track needs to open in response to a runtime condition (a button click, a
search hit, a parent prop) rather than at first mount, call the imperative
`showTrack` action after construction instead of baking the trackId into
`init`. This requires the unmanaged `createViewState` flow, since the managed
`<CircularGenomeView>` only reads its props once on mount:

```js
const s = createViewState({ assembly, tracks })
s.session.view.showTrack('volvox_sv_test')
```

For tracks you want open on first paint, list their trackIds in the managed
component's [`init`](../volvox/) prop instead. `showTrack` and the view's other
actions are documented in the
[CircularView state model](https://jbrowse.org/jb2/docs/models/circularview/).
