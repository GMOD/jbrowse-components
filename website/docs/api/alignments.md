---
id: alignments
title: alignments
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how to
import these from a plugin.

## computeDerivativePaths

Rank the derivative paths the reads in view describe, most-supported first.

Every path above `minReads` is returned, not a top-N: how MANY paths a window
produces is itself evidence about all of them. One or two is what a real event
looks like; forty is a repeat, and a caller that had already truncated to ten
could not tell a reader that. Presenting a shorter list is the picker's job,
and it says what it left out.

```js
// type signature
(opts: ComputeDerivativePathsOpts) => DerivativeCandidate[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/derivativePaths/computePaths.ts)

## computeReadChains

Every fetched read's complete segment chain, in read order. Routed through
the same `resolveReadGroup` skeleton the arcs use, so the secondary filter,
the readId dedup and the mate partition are applied identically and the two
cannot disagree about which segments belong to one read.

The arc path turns each chain into junction arcs; `derivativePaths` reads the
chains themselves to propose a derivative allele. Sharing the builder is what
keeps the proposal's segment ORDER and ORIENTATION honest: read order is not
genomic order across an inversion, and `unpairedReadChain` is where that is
already resolved.

EVERY LANE AT ONCE, which is why this takes a list of data maps rather than
one. A display's grouping (by strand, by HP tag, by any tag) partitions reads
for DRAWING and says nothing about which molecule carries which junction, so
chaining one lane at a time and concatenating the results counts a read once
per lane its segments landed in: each lane sees one segment as a fetched entry
and the rest through that segment's own SA tag, so it emits a complete chain
of its own and the identical chains group. Grouping by strand is the case that
bites, because a read crossing an inversion has segments on both strands BY
DEFINITION — the der(3) fold-back reported 4 reads for the 2 that exist.
Bucketing every lane's entries under one QNAME first is also what puts the
partner segment back on screen, so `extendsOffScreen` stops claiming a path
leaves a window both of its ends are drawn in.

Chains of one segment are dropped: a read with no junction describes no
rearrangement.

```js
// type signature
(lanes: Iterable<ReadonlyMap<number, WorkerPileupData>>, regions: RegionInfo[], canonicalRefName?: CanonicalRefName) => SegAln[][]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/arcs/arcChains.ts)

## segmentEntryBp

The reference coordinate the path ARRIVES at this segment by.

The read enters a forward segment at its lower coordinate and a reverse one at
its higher. Read order is not genomic order, so every edge here is asked for
by ROLE (entry/exit along the read), never by min/max — and this pair is
exported because the rule has a consumer outside the grouping: a drawing that
opens one panel per segment has to point each panel at the junction that
segment carries. Spelled a second time there, nothing held the two spellings
against each other, and getting one backwards is invisible rather than loud —
the panel opens a segment-length from where the reads land and simply draws no
connections.

```js
// type signature
(seg: { start: number; end: number; strand: number; }) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/derivativePaths/computePaths.ts)

## segmentExitBp

The reference coordinate the path LEAVES this segment by.

The mirror of segmentEntryBp, and exported for the same consumer.

```js
// type signature
(seg: { start: number; end: number; strand: number; }) => number
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/derivativePaths/computePaths.ts)
