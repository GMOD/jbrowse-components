Clicking a feature opens its details widget and sets `session.selection` to that
feature. `selection` is plain observable state, so an `observer` panel outside
the view can mirror it into your own app — highlight a row in a table, fetch
related records, update a URL — with no click handler registered:

```jsx
const SelectedFeature = observer(function SelectedFeature({ viewState }) {
  const { selection } = viewState.session
  return isFeature(selection) ? <p>Selected {selection.get('name')}</p> : null
})
```

`selection` is typed `unknown` because it can hold anything the app selects (a
feature, a view, a region), so guard it with `isFeature` from
`@jbrowse/core/util` before reading `get('name')`/`get('start')`. It is the same
[reactive pattern](../multiple-views/#observe-visible) used to watch the visible
region.

To change what the details panel itself shows, pass a `formatDetails` block to
`createViewState`'s `configuration` option — the same global-config object used
for the [custom theme](../theming/#with-custom-theme). Its slots are listed in
the
[root configuration reference](https://jbrowse.org/jb2/docs/config/jbrowseconfiguration/),
and
[Customizing feature details](https://jbrowse.org/jb2/docs/config_guides/customizing_feature_details/)
walks through the callbacks.
