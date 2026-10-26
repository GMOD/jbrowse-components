# RenderAlignmentDataRPC

The worker knows no chains: chain identity is joined on the main thread
(`attachChainFields`, ADR-188). Row-instanced passes are packed on the main
thread after layout (ADR-053); position-aggregate passes are packed in the
worker and uploaded verbatim.

## Group-by

- **`chainGroupingKey` is the only by-name grouping key.** It gives secondary
  alignments and nameless features (PAF blocks) a unique synthetic key; keyed by
  name, every PAF block in a region became one chain.
- **Keep every dimension a closed set**; `MAX_GROUPS` is only a backstop. Each
  group allocates region-width depth arrays and a GPU coverage buffer.
- The `''` untagged group stays out of the overflow merge — reads lacking the
  tag are an answer users look for.
- **The cap is per call**, so only `orderedGroups` can size the drawn overflow
  lane; that is why merged keys ride on the group.
- **`fragmentLevel` is not "every read yields the same key"**: a supplementary
  carries its own strand and pair orientation, and the primary read1 answers for
  the fragment. A chain can therefore sit in two sections across regions, which
  is why `attachChainFields` unions by name across lanes too.
- Key generators serve SAM and flagless records alike: `strand`, not
  `SAM_FLAG_REVERSE`.

## Types per invalidation tier

`WorkerPileupData` → `ChainedPileupData` → layout → color bakes →
`PileupDataResult`. Type a function by the narrowest tier it reads; the worker
never ships placeholders for fields a later tier produces.

**Fixtures build on `testPileupData` (`baseWorkerPileupData`,
`basePileupDataResult`), never `as unknown as`.** The optional fields are left
out on purpose: `isChainData` narrows on them.

## Placement and sort

- **The placement axis is segmented per refName in both layouts** — pileup and
  chain. One shared axis collides regions that never overlap on screen.
- **`sortColumn` is config, so it goes through `sortForRegions`** in both layout
  paths: it applies only when every laid-out region is on its refName.
- **`partitionBySort` is not a span test.** A right-edge clip sits at the read's
  exclusive end, so `end > sortPos` alone drops the reads the sort is about.
- `showSoftClips` belongs in `rpcProps`: the worker gates per-base extraction on
  it.
