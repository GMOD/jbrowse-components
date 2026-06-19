When a track needs to open in response to a runtime condition (a button click, a
search hit, a parent prop) rather than at first mount, call the imperative
`showTrack` action after construction instead of baking the trackId into
`defaultSession`:

```js
const s = createViewState({ assembly, tracks })
s.session.view.showTrack('volvox_sv_test')
```

For tracks you want open on first paint, list their trackIds in the view's
[`init`](../volvox/) field instead.
