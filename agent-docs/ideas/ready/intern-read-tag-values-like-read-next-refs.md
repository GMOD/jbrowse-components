---
name: intern-read-tag-values-like-read-next-refs
description: The `tag` and `mateRefName` color schemes ship `readTagValues` as one string per read across the RPC, the shape `readNextRefs` measured at 2.8x the cost of slots plus a table and replaced. Interning it also takes the legend's swatch list off an O(reads) scan.
---

# Intern `readTagValues` the way `readNextRefs` was interned

Both CPU-baked color schemes (`tag`, `mateRefName`) ship
`readTagValues: string[]` (`RenderAlignmentDataRPC/types.ts`), one string per
read across the RPC boundary. It is the shape this plugin has already measured
and deleted once, one field over. `shared/readNextRefs.ts` records the number
for the identical array: **153,677 strings holding one distinct value, 16.5 ms
to build and 8.0 ms to structured-clone, against 8.8 ms for a
slots-plus-table**, that is 2.8x, with a bench at
`benches/readNextRefs.bench.ts`. The tag case has the same distribution: HP
carries two or three values over a whole pileup, RG a handful, a mate reference
usually one.

## The shape

`readNextRefs`': a transferable `Int32Array` of slots plus a table of distinct
values, read through an accessor. `presentTagValues`
(`alignmentsColorViews.ts`, the legend's whole swatch list for these schemes)
then comes off the table rather than off an O(reads) scan.

## What does not work, checked

Reusing `readNextRefIds` / `nextRefNames` for `mateRefName` rather than adding
a second dictionary. `buildReadNextRefs` reads only `next_ref`, while
`getMateRefName` also reads a synteny block's `mate.refName`, so
LGVSyntenyDisplay's "Query name" would resolve `''` for every block. Teaching
the nextRefs table to read `mate.refName` fixes that and breaks something
quieter: `buildReadInterchrom` compares those names against the region's
refName, and a PAF block's mate is a query contig on the *other* assembly, so
every synteny block would come back interchromosomal and lose its chevron
(`dirMoot`).

That also kills the tempting corollary, that `mateRefName` could drop
`workerExtracts` and become a tier-2 recolor instead of a refetch. It cannot:
the worker still has to extract the value. The win here is payload and clone
time only.
