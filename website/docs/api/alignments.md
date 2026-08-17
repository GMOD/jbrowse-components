---
id: alignments
title: alignments
---

Auto-generated from exported functions tagged `#api` in the source. See
[imports and re-exports](/docs/developer_guides/imports_and_reexports) for how
to import these from a plugin.

## computeDerivativePaths

Rank the derivative paths the reads in view describe, most-supported first.

Every path above `minReads` is returned, not a top-N: how MANY paths a window
produces is itself evidence about all of them. One or two is what a real event
looks like; forty is a repeat, and a caller that had already truncated to ten
could not tell a reader that. Presenting a shorter list is the picker's job, and
it says what it left out.

```js
// type signature
(opts: ComputeDerivativePathsOpts) => DerivativeCandidate[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/derivativePaths/computePaths.ts)

## computeReadChains

Every fetched read's complete segment chain, in read order. Routed through the
same `resolveReadGroup` skeleton the arcs use, so the secondary filter, the
readId dedup and the mate partition are applied identically and the two cannot
disagree about which segments belong to one read.

The arc path turns each chain into junction arcs; `derivativePaths` reads the
chains themselves to propose a derivative allele. Sharing the builder is what
keeps the proposal's segment ORDER and ORIENTATION honest: read order is not
genomic order across an inversion, and `unpairedReadChain` is where that is
already resolved.

Chains of one segment are dropped: a read with no junction describes no
rearrangement.

```js
// type signature
(rpcDataMap: ReadonlyMap<number, WorkerPileupData>, regions: RegionInfo[], canonicalRefName?: CanonicalRefName) => SegAln[][]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/arcs/arcChains.ts)
