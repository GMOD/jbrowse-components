Everything is passed to `<LinearGenomeView>` as props — no `createViewState`
call needed. The full, runnable file is below.

`onChange` fires with a JSON patch on every state mutation (pan, zoom, track
toggle) — the hook you'd use to persist the session or sync it to a URL.

`init.loc` takes a locstring only. To navigate by a `{refName, start, end}`
object, or to drive the view imperatively from an outside button, go through a
`ref` and call `navToLocations` — see
[external navigation](../navigate-to-location/#external-navigate). For the
lower-level `createViewState` + `<JBrowseLinearGenomeView>` form, see the
[embedded components guide](https://jbrowse.org/jb2/docs/embedded_components/).
