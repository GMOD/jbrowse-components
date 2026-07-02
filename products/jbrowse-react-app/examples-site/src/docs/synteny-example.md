A `react-app2` session can hold any number of views of any type, side by side.
Each view type launches the same declarative way: a
[`defaultSession.views`](../basic-example/) entry with a `type` and an `init`
field. `init` is the same shape JBrowse Web serializes into its
`?session=spec-…` URL parameter (see the
[URL query parameter API](https://jbrowse.org/jb2/docs/urlparams/)), so these
examples are the programmatic equivalent of those URLs.

`LinearSyntenyView` shows two linear genome views with a connecting ribbon for
synteny features (PAF, MUMMER, etc.). The `init` field declares the two member
assemblies and the synteny track that ties them together — much terser than
hand-building two `LinearGenomeView` snapshots plus a synteny view snapshot:

```js
{
  type: 'LinearSyntenyView',
  init: {
    views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
    tracks: ['volvox_del.paf'],
  },
}
```

The exact fields each view's `init`/snapshot accepts come from its
[state model docs](https://jbrowse.org/jb2/docs/models/) — see
[LinearSyntenyView](https://jbrowse.org/jb2/docs/models/linearsyntenyview/).
