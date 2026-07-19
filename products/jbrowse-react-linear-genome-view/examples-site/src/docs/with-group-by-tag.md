Alignments tracks can group reads by a SAM tag: haplotype (`HP`), cell barcode,
or any other tag your BAM/CRAM carries. Grouping splits the pileup into labeled
lanes, each drawn independently. Set it on the display via `groupBy`, as a
`displaySnapshot` on an `init.tracks` entry:

```js
init: {
  loc: 'ctgA:39,728..40,459',
  tracks: [
    {
      trackId: 'volvox_bam',
      displaySnapshot: {
        type: 'LinearAlignmentsDisplay',
        height: 400,
        groupBy: { type: 'tag', tag: 'HP' },
        // pairing colorBy on the same tag shades each haplotype distinctly
        colorBy: { type: 'tag', tag: 'HP' },
      },
    },
  ],
}
```

Pairing `colorBy` on the same tag colors each haplotype lane (`HP:0`, `HP:1`,
and the unassigned reads) distinctly. Both are part of the
[LinearAlignmentsDisplay](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/)
config. See
[initializing an alignments display](../alignments-tracks/#with-init-alignments-display)
for the broader set of alignments display settings.
