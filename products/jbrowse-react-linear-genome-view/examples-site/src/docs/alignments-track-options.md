An `AlignmentsTrack` opens with a
[`LinearAlignmentsDisplay`](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/),
whose behavior is controlled by a large set of config slots. You can set any of
them up front, either inside `init.tracks[].displaySnapshot` (used here) or via
the
[`displayDefaults` shorthand](https://jbrowse.org/jb2/docs/config_guides/tracks/)
on the track config, and change them later from the track menu.

This example loads HG002 haplotagged nanopore reads at the imprinted **SNRPN**
locus. Because the reads carry an HP (haplotype) tag, coloring and grouping by
that tag stacks the two parental alleles into separate, distinctly-colored
groups. `displaySnapshot` is a property of the track entry, so it always travels
with the full track config it applies to:

```js
// register the track...
const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'hg002_snrpn_5mc',
    name: 'HG002 SNRPN 5mC (haplotagged nanopore)',
    assemblyNames: ['GRCh38'],
    adapter: {
      type: 'BamAdapter',
      uri: 'https://jbrowse.org/demos/methylation/HG002_SNRPN_5mC_haplotagged.bam',
    },
  },
]

// ...then open it with display options up front
const init = {
  loc: 'chr15:24,954,000..24,972,000',
  tracks: [
    {
      trackId: 'hg002_snrpn_5mc',
      displaySnapshot: {
        type: 'LinearAlignmentsDisplay',
        height: 500,
        // color + group reads by their HP (haplotype) tag
        colorBy: { type: 'tag', tag: 'HP' },
        groupBy: { type: 'tag', tag: 'HP' },
      },
    },
  ],
}
```

Some of the most useful slots:

- **`colorBy`**:
  `{ type: 'normal' | 'strand' | 'mappingQuality' | 'perBaseQuality' | 'pairOrientation' | 'insertSize' | 'insertSizeAndOrientation' | 'modifications' | 'tag', tag? }`.
- **`groupBy`**: in-track stacked grouping, e.g. `{ type: 'strand' }` or
  `{ type: 'tag', tag: 'HP' }`.
- **`filterBy`**: SAM-flag include/exclude plus optional read-name / tag
  filters, e.g. `{ flagInclude: 0, flagExclude: 3844 }`.
- **`sortedBy`**: order reads at a position, e.g. by base, strand, or a tag
  (usually set by right-clicking a column).
- **`showSoftClipping`**, **`showCoverage`**, **`mismatchAlpha`**: booleans for
  clipped bases, the coverage band, and quality-faded mismatches.
- **`height`**, **`featureHeight`**, **`heightMode`**: track sizing (see
  [Track sizing: grow & fit](../track-sizing/)).
- **`linkedReads`**, **`readConnections`**: long-read / paired-read chaining and
  connection arcs.

For the complete, always-current list, see the generated
[LinearAlignmentsDisplay config](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/)
and [state model](https://jbrowse.org/jb2/docs/models/linearalignmentsdisplay/)
reference pages.

The reads here carry 5mC methylation calls; the
[DNA methylation tutorial](https://jbrowse.org/jb2/docs/tutorials/methylation/)
covers per-read, aggregate, and allele-specific methylation from long reads.
