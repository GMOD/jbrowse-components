---
name: the-gbz-reader-owes-identity-and-an-align-comparison
description: A GBZ multiway lane's records carry no `identity`, so the identity color mode is dead on it, and nothing has compared the reader's `align()` CIGARs with `gfa_to_pairwise_paf.py`'s though the lane's gap split reads them. Both are work in `@gmod/gbz-base` and jbrowse-plugin-graphgenomeviewer.
---

# The GBZ reader owes identity and an align() comparison

A GBZ lane's records come from `GbzBaseSyntenyAdapter` in
`jbrowse-plugin-graphgenomeviewer`, over the `@gmod/gbz-base` reader. The lane
selection already reaches the reader: `keepPredicate` hands the wanted
haplotypes to `cutWindowTables`, so a window walks only those, and the graph
view's `GetSubgraph` takes the same `haplotypes`.

What the other two repositories still owe `MultiWaySyntenyDisplay`:

- `identity` on the reader's records, so the identity color mode stops being
  dead on a GBZ lane.
- The reader's `align()` measured against
  [`gfa_to_pairwise_paf.py`](https://github.com/cmdcolin/gfa-to-pairwise-paf)
  on the E. coli oracle. The two emit different CIGARs for the same walks by
  design (`50I50D` against `50X`), nothing has compared them, and the display's
  gap split reads the CIGAR's interior.
- Opening a multiway display from a graph node: the node's `samples` could go to
  the display's `setSelectedLanes`.

Static GFAs cut with `--keep` for every tutorial locus meet the same need at
zero runtime cost for a fixed locus and set, and do not generalise to a window
the reader chooses.
