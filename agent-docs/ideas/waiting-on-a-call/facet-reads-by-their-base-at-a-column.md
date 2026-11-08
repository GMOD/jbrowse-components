---
name: facet-reads-by-their-base-at-a-column
description: "A column facet, `{ field: 'base', pos, refName }`, would section an alignments track by the allele each read carries at one position, for allele-specific expression without HP tags. Open: whether the key needs a second CIGAR walk."
---

# Facet reads by their base at a column

`sort` already orders the pileup by the base each read carries at a column
(`sortColumn`). A facet over the same read, `{ field: 'base', pos, refName }`,
would put each allele's reads in a section of its own, with its own coverage:
allele-specific expression in RNA-seq, or a phase split at a heterozygous
site, where the BAM has no HP tags.

## Open

- **One CIGAR walk or two.** Whether the facet key can read the base the sort
  column already resolves, or needs its own walk per read in the worker. The
  facet runs in the worker (`partitionFeatures`) and the sort on the main
  thread (ADR-053), so the answer decides where the key is computed.
- **The sections' order and labels**: by allele count, or reference first.
- **What a read with no base there files as**: a deletion, a skip (`N`), or
  not covering the column.

Raised in the 2026-11-07 alignments analysis; not taken up there.
