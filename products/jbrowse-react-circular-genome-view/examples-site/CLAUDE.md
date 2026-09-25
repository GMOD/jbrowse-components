# examples-site

Shared doctrine for all four sites:
[agent-docs/reference/EXAMPLES_SITES.md](../../../agent-docs/reference/EXAMPLES_SITES.md).
Local to this one:

The published package an example may import from is
`@jbrowse/react-circular-genome-view2`.

`checkRingsPainted` in `pnpm smoke` asks whether each ring canvas holds any ink,
because a ring whose fetch answered nothing still reports itself drawn. The gene
density rings drew an empty band that way: the bigWig spells its contigs
`hg38.chr1`, and only the tutorial's alias tables, not the hub's, know that
name.

The relative-import grep returns nothing at all here — this site takes not even
the bulk-data exception, and it should stay that way.
