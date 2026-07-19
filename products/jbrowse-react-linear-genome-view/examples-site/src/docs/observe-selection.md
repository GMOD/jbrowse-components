Clicking a feature opens its details widget — and it also sets
`session.selection` to that feature. `selection` is plain observable state, so an
`observer` panel outside the view re-renders whenever it changes, letting you
mirror the current selection into your own app (highlight a row in a table, fetch
related records, update a URL) without registering a click handler:

```jsx
const SelectedFeature = observer(function SelectedFeature({ viewState }) {
  const { selection } = viewState.session
  return isFeature(selection) ? (
    <p>Selected {selection.get('name')}</p>
  ) : null
})
```

`selection` is typed as `unknown` because it can hold anything the app selects
(a feature, a view, a region), so guard it with the `isFeature` helper from
`@jbrowse/core/util` before reading `get('name')`/`get('start')`. Read
`session.selection` from a component
wrapped in `observer` — the same [reactive pattern](../multiple-views/#observe-visible)
used to watch the visible region — rather than polling; MobX handles the
subscription. To style the click itself (feature detail formatting, custom
widgets), see
[customizing feature details](https://jbrowse.org/jb2/docs/config_guides/customizing_feature_details/).
