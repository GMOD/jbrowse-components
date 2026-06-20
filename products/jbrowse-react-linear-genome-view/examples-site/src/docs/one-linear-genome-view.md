The smallest end-to-end example: pass an `assembly`, a list of `tracks`, an
initial `location`, and an `onChange` handler to `createViewState`, then render
`<JBrowseLinearGenomeView viewState={state} />`.

`onChange` fires with a JSON patch every time the view state mutates (pan, zoom,
track toggles), which is the hook you'd use to persist the session or sync it to
a URL.

```js
const state = createViewState({
  assembly,
  tracks,
  location: 'ctgA:1105..1221',
  onChange: patch => {
    // called on every state mutation
  },
})
```

For most apps the [`init`](../with-init/) field is the more ergonomic way to
specify the opening state. This example uses the top-level `location` shortcut
instead — see [Using a location object](../using-loc-object/) for the parsed
form, and the
[embedded components guide](https://jbrowse.org/jb2/docs/embedded_components/)
for `createViewState` and the `onChange` callback.
