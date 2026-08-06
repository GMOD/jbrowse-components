Clicking a feature opens its details widget and sets `session.selection`. That
is plain observable state, so an `observer` panel outside the view mirrors it
into your app — highlight a table row, fetch related records, update a URL —
with no click handler registered.

`selection` is typed `unknown`, because it can hold whatever the app selected (a
feature, a view, a region). Guard it with `isFeature` from `@jbrowse/core/util`
before reading `get('name')`. It is the same
[reactive pattern](../multiple-views/#observe-visible) as watching the visible
region.

To change what the details panel itself shows, pass a `formatDetails` block in
`createViewState`'s `configuration` — see
[customizing feature details](https://jbrowse.org/jb2/docs/config_guides/customizing_feature_details/).
