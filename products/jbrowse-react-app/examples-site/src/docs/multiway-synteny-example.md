A `LinearSyntenyView` is not limited to two genomes. Give `init.views` three or
more assemblies and the view stacks them as rows, each adjacent pair joined by a
connecting ribbon. This example stacks four _E. coli_ strains (K-12, Sakai,
CFT073, NCTC86) — the pangenome demo from the all-vs-all synteny tutorial.

With N rows there are N−1 bands, so `tracks` is an array _per band_: `tracks[i]`
holds the track(s) connecting `views[i]` and `views[i+1]`. Because a single
**all-vs-all** PAF aligns every strain to every other, one
[SyntenyTrack](https://jbrowse.org/jb2/docs/config/syntenytrack/) using an
[AllVsAllPAFAdapter](https://jbrowse.org/jb2/docs/config/allvsallpafadapter/)
(whose `assemblyNames` lists all four strains) backs all three bands:

```js
{
  type: 'LinearSyntenyView',
  init: {
    views: [
      { assembly: 'K12' },
      { assembly: 'Sakai' },
      { assembly: 'CFT073' },
      { assembly: 'NCTC86' },
    ],
    tracks: [['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava']],
    drawCurves: true,
    minAlignmentLength: 10000,
  },
}
```

`minAlignmentLength` hides the short minimap2 alignments so the shared backbone
reads as clean ribbons. The nested `tracks` shape matches JBrowse Web's
multi-way `?session=spec-…` URL — see the multi-way section of the
[URL query parameter API](https://jbrowse.org/jb2/docs/urlparams/). For separate
pairwise files instead of one all-vs-all track, give each band its own PAF.

The full set of fields `init` accepts is in the
[LinearSyntenyView state model docs](https://jbrowse.org/jb2/docs/models/linearsyntenyview/).
