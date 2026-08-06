HG002 haplotagged nanopore reads at the imprinted SNRPN locus. The reads carry
an `HP` tag, so coloring and grouping by it stacks the two parental alleles into
separate lanes.

An `AlignmentsTrack` draws through a
[`LinearAlignmentsDisplay`](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/),
configured up front in `init.tracks[].displaySnapshot` (below) or via
[`displayDefaults`](https://jbrowse.org/jb2/docs/config_guides/tracks/), and
changeable afterwards from the track menu. The slots worth knowing:

- **`colorBy`** —
  `{ type: 'normal' | 'strand' | 'mappingQuality' | 'perBaseQuality' | 'pairOrientation' | 'insertSize' | 'insertSizeAndOrientation' | 'modifications' | 'tag', tag? }`
- **`groupBy`** — stacked lanes, e.g. `{ type: 'tag', tag: 'HP' }`
- **`filterBy`** — SAM flags plus read-name/tag filters, e.g.
  `{ flagInclude: 0, flagExclude: 3844 }`
- **`sortedBy`** — read order at a position, usually set by right-clicking a
  column
- **`showSoftClipping`**, **`showCoverage`**, **`mismatchAlpha`** — clipped
  bases, the coverage band, quality-faded mismatches
- **`height`**, **`featureHeight`**,
  [**`heightMode`**](../feature-colors-and-labels/#track-sizing)
- **`linkedReads`**, **`readConnections`** — long-read and paired-read chaining

The always-current list is the generated
[config](https://jbrowse.org/jb2/docs/config/linearalignmentsdisplay/) and
[state model](https://jbrowse.org/jb2/docs/models/linearalignmentsdisplay/)
pages. These reads also carry 5mC calls; the
[DNA methylation tutorial](https://jbrowse.org/jb2/docs/tutorials/methylation/)
covers per-read, aggregate and allele-specific methylation.
