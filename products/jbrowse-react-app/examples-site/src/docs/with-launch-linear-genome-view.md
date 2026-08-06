Most [view types](../comparative-views/#synteny-example) are declared up front
in `views`. For one that should appear in response to something at runtime — a
button, a search hit, a backend event — use the `LaunchView-*` extension points.
This demo boots an empty session and launches a `LinearGenomeView` after mount:

```js
await pluginManager.evaluateAsyncExtensionPoint('LaunchView-LinearGenomeView', {
  session: state.session,
  assembly: 'hg38',
  loc: 'chr10:1-100000',
  tracks: ['my_track'],
})
// also: LaunchView-LinearSyntenyView, LaunchView-DotplotView
```

This is the machinery the import wizard uses, so anything a user can launch from
the UI you can launch from code. The shared `init` model behind every launch
surface is described in
[Automating JBrowse](https://jbrowse.org/jb2/docs/automating/).
