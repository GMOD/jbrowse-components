A `LinearSyntenyView` is not limited to two genomes: give `init.views` three or
more assemblies and it stacks them as rows, each adjacent pair joined by a
ribbon. Here four _E. coli_ strains (K-12, Sakai, CFT073, NCTC86), the pangenome
demo from the
[all-vs-all synteny tutorial](https://jbrowse.org/jb2/docs/tutorials/allvsall_synteny/).

**With N rows there are N−1 bands, so `tracks` is an array _per band_** —
`tracks[i]` connects `views[i]` and `views[i+1]`. Because a single all-vs-all
PAF aligns every strain to every other, one
[SyntenyTrack](https://jbrowse.org/jb2/docs/config/syntenytrack/) over an
[AllVsAllPAFAdapter](https://jbrowse.org/jb2/docs/config/allvsallpafadapter/)
backs all three bands:

```js
tracks: [['ecoli_ava'], ['ecoli_ava'], ['ecoli_ava']]
```

`minAlignmentLength` hides the short minimap2 alignments so the shared backbone
reads as clean ribbons. For separate pairwise files, give each band its own PAF.
Fields:
[LinearSyntenyView](https://jbrowse.org/jb2/docs/models/linearsyntenyview/).
