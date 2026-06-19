Alignments tracks can group reads by a SAM tag — haplotype (`HP`), cell barcode,
or any other tag your BAM/CRAM carries. Grouping splits the pileup into labeled
lanes, each drawn independently. Set it on the display via `groupBy`:

```js
displaySnapshot: {
  type: 'LinearAlignmentsDisplay',
  height: 400,
  groupBy: { type: 'tag', tag: 'HP' },
}
```

The grouping options are part of the
[LinearAlignmentsDisplay](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/)
config. See
[initializing an alignments display](../with-init-alignments-display/) for the
broader set of alignments display settings.
