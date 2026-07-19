An `AlignmentsTrack` opens with a
[`LinearAlignmentsDisplay`](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/),
whose behavior is controlled by a large set of config slots. You can set any of
them up front — either inside `init.tracks[].displaySnapshot` (used here) or via
the [`displayDefaults` shorthand](https://jbrowse.org/jb2/docs/config_guides/tracks/)
on the track config — and change them later from the track menu.

This example loads HG002 nanopore reads at the imprinted **SNRPN** locus. The
reads were basecalled with 5mC modification tags and haplotagged, so two options
together tell the biological story — allele-specific methylation:

```js
displaySnapshot: {
  type: 'LinearAlignmentsDisplay',
  height: 500,
  // color each base by its 5mC modification probability (MM/ML tags)
  colorBy: { type: 'modifications', modifications: { fillUnmarked: true } },
  // stack reads into per-haplotype groups using the HP tag
  groupBy: { type: 'tag', tag: 'HP' },
  // exclude secondary/supplementary/duplicate/QC-fail reads
  filterBy: { flagInclude: 0, flagExclude: 3844 },
}
```

Some of the most useful slots:

- **`colorBy`** — `{ type: 'normal' | 'strand' | 'mappingQuality' | 'perBaseQuality' | 'pairOrientation' | 'insertSize' | 'insertSizeAndOrientation' | 'modifications' | 'tag', tag? }`.
- **`groupBy`** — in-track stacked grouping, e.g. `{ type: 'strand' }` or `{ type: 'tag', tag: 'HP' }`.
- **`filterBy`** — SAM-flag include/exclude plus optional read-name / tag filters, e.g. `{ flagInclude: 0, flagExclude: 3844 }`.
- **`sortedBy`** — order reads at a position, e.g. by base, strand, or a tag (usually set by right-clicking a column).
- **`showSoftClipping`**, **`showCoverage`**, **`mismatchAlpha`** — booleans for clipped bases, the coverage band, and quality-faded mismatches.
- **`height`**, **`featureHeight`**, **`heightMode`** — track sizing (see [Track sizing: grow & fit](../track-sizing/)).
- **`linkedReads`**, **`readConnections`** — long-read / paired-read chaining and connection arcs.

For the complete, always-current list, see the generated
[LinearAlignmentsDisplay config](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/)
and
[state model](https://jbrowse.org/jb2/docs/models/linearalignmentsdisplay/)
reference pages.
