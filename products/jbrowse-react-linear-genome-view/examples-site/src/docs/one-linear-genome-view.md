`onChange` fires a JSON patch on every state mutation (pan, zoom, track toggle).
Use it to persist the session or sync a URL.

`init.loc` takes a locstring only. For a `{refName, start, end}` object, or to
drive the view from an outside button, use a `ref` and call `navToLocations`
(see [external navigation](../navigate-to-location/#external-navigate)). For the
lower-level `createViewState` + `<JBrowseLinearGenomeView>` form, see the
[embedded components guide](https://jbrowse.org/jb2/docs/embedded_components/).
