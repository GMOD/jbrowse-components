# RenderAlignmentDataRPC

The worker knows no chains: chain identity is joined on the main thread
(`attachChainFields`). Row-instanced passes are packed on the main thread after
layout; position-aggregate passes are packed in the worker and uploaded
verbatim.

## Group-by

- **`chainGroupingKey` is the only by-name grouping key.** It gives secondary
  alignments and nameless features (PAF blocks) a unique synthetic key; keyed by
  name, every PAF block in a region becomes one chain.
- **Keep every dimension a closed set**; `MAX_GROUPS` is only a backstop. Each
  group allocates region-width depth arrays and a GPU coverage buffer.
- **Keep the `''` untagged group out of the overflow merge** — reads lacking the
  tag are an answer users look for.
- **`fragmentLevel` is not "every read yields the same key"**: a supplementary
  carries its own strand and pair orientation, and the primary read1 answers for
  the fragment. A chain can therefore sit in two sections across regions, which
  is why `attachChainFields` unions by name across lanes too.

## Types per invalidation tier

`WorkerPileupData` → `ChainedPileupData` → layout → color bakes →
`PileupDataResult`. Type a function by the narrowest tier it reads; the worker
never ships placeholders for fields a later tier produces.

**Build fixtures on `testPileupData` (`baseWorkerPileupData`,
`basePileupDataResult`), not `as unknown as`.** The optional fields are left out
on purpose: `isChainData` narrows on them.

## Placement and sort

- **Segment the placement axis per refName in both layouts** — pileup and chain.
  One shared axis collides regions that never overlap on screen.
- **Apply `sortColumn` through `sortForRegions`** in both layout paths: it
  applies only when every laid-out region is on its refName.
- **Put `showSoftClips` in `rpcProps`**: the worker gates per-base extraction on
  it.
