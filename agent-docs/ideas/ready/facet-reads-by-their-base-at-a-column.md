---
name: facet-reads-by-their-base-at-a-column
description: "A column facet, `{ field: 'base', pos, refName }`, sections an alignments track by the allele each read carries at one position, for allele-specific expression without HP tags. The key is a second CIGAR walk in the worker, reference allele first."
---

# Facet reads by their base at a column

## Ruling

The key gets its own CIGAR walk in the worker, beside `partitionFeatures`:
the sort resolves its column on the main thread, and that never reaches the
worker. Sections run reference allele first, then the other alleles.

`sort` already orders the pileup by the base each read carries at a column
(`sortColumn`). A facet over the same read, `{ field: 'base', pos, refName }`,
would put each allele's reads in a section of its own, with its own coverage:
allele-specific expression in RNA-seq, or a phase split at a heterozygous
site, where the BAM has no HP tags.

## Why a second walk

The facet runs in the worker (`partitionFeatures`) and the sort on the main
thread (ADR-053), so the key cannot read the base the sort column resolves.

## Left to the build

What a read with no base there files as: a deletion, a skip (`N`), or not
covering the column.
