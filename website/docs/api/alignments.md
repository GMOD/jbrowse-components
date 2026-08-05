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

## computeNamedReadChains

`computeReadChains` with each chain still attached to the read it came from.

The name is only a label to the grouping — reads are grouped by it and then the
name is dropped — but a chain DRAWN somewhere has to say which read it is, so a
consumer that draws one (`projectReadsOntoDerivative`) needs the same pairing
the grouping already had rather than a second walk of the pileup arrays to
recover it.

```js
// type signature
(rpcDataMap: ReadonlyMap<number, PileupDataResult>, regions: RegionInfo[], canonicalRefName?: ((refName: string) => string) | undefined) => NamedReadChain[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/arcs/compute.ts)

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
(rpcDataMap: ReadonlyMap<number, PileupDataResult>, regions: RegionInfo[], canonicalRefName?: ((refName: string) => string) | undefined) => SegAln[][]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/arcs/compute.ts)

## derivativeOffsets

Where each path segment starts on the derivative axis, as a prefix sum with the
total length in the final entry — so `offsets[i]` is segment i's origin and
`offsets[segments.length]` is the allele's length.

The one spelling of the offset walk. `buildDerivativeVsRefSpec` lays the ribbons
out with it and this file places reads with it, and a second spelling of it
would put the reads somewhere other than the ribbons they belong to without
either side looking wrong on its own.

```js
// type signature
(segments: DerivativeSegment[]) => number[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/derivativePaths/projectReads.ts)

## projectReadsOntoDerivative

Place each read's chain on a derivative path, in the path's own coordinates.

Reads that touch the path nowhere are dropped; every other read is returned
whether or not it fits, because the ones that do not are the contrast that makes
the ones that do mean something.

```js
// type signature
(opts: ProjectReadsOpts) => ProjectedRead[]
```

[Source code](https://github.com/GMOD/jbrowse-components/blob/main/plugins/alignments/src/features/derivativePaths/projectReads.ts)
