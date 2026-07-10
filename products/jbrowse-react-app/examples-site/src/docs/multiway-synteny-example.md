A `LinearSyntenyView` is not limited to two genomes. Give `init.views` three or
more assemblies and the view stacks them as rows, each adjacent pair joined by a
connecting ribbon.

The difference from the [two-genome synteny example](../synteny-example/) is the
`tracks` field. With N rows there are N−1 bands, so `tracks` becomes an array
_per band_: `tracks[i]` holds the track(s) connecting `views[i]` and
`views[i+1]`. Here three volvox assemblies are chained with two pairwise PAFs:

```js
{
  type: 'LinearSyntenyView',
  init: {
    views: [
      { assembly: 'volvox_ins' },
      { assembly: 'volvox' },
      { assembly: 'volvox_del' },
    ],
    // band 0 (volvox_ins↔volvox), band 1 (volvox↔volvox_del)
    tracks: [['volvox_ins.paf'], ['volvox_del.paf']],
  },
}
```

The nested `tracks` shape matches JBrowse Web's multi-way `?session=spec-…` URL
— see the multi-way section of the
[URL query parameter API](https://jbrowse.org/jb2/docs/urlparams/). A single
all-vs-all track (one PAF whose `assemblyNames` lists every genome, via the
[AllVsAllPAFAdapter](https://jbrowse.org/jb2/docs/config/allvsallpafadapter/))
can back every band instead of separate pairwise files.

The full set of fields `init` accepts is in the
[LinearSyntenyView state model docs](https://jbrowse.org/jb2/docs/models/linearsyntenyview/).
