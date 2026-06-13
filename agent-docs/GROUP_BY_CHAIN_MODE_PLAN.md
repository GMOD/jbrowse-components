# Plan: grouping + chain mode

Enable in-track group-by while `linkedReads === 'normal'` (chain / linked-read
layout). Today the worker forces grouping off in chain mode
(`executeRenderAlignmentData.ts`: `const groupBy = isChain ? undefined :
groupByArg`).

## The core problem

Chain mode groups reads into chains by **QNAME** — a read plus its mate and
supplementaries share a chain and must lay out as one unit on one row. Group-by
partitions reads by a key. If two reads of the same chain land in **different**
groups, the chain splits across sections: connecting lines break and the mates'
rows desync. So the partition must be **chain-aware**.

Key fact that makes this tractable: the **main-thread layout is already
group-aware for chains.** `buildLaidOutByGroup` (`groupLayout.ts`) already calls
`buildLaidOutChainMap` per group. Connecting lines, intra-chain overlaps, and
the Flatbush hit index are all built per group/region. The blocker is purely the
worker partition step.

## Core design decision: partition by _chain_, not by _read_

Assign each whole chain to exactly one group via a **representative read's** key
(primary, non-supplementary, non-secondary, prefer read1; fallback to the first
read). Every read of the chain follows that key, so chains stay whole by
construction.

This stays consistent **across regions** — where each region is a separate
worker call that cannot see the others' reads — only for **chain-consistent**
dimensions, i.e. ones where every read in the chain yields the same key
regardless of which region it sits in:

| Dimension           | Chain-consistent?              | Allow in chain mode?                  |
| ------------------- | ------------------------------ | ------------------------------------- |
| `tag` (HP, RG)      | yes (per-template tag)         | yes — the marquee use case            |
| `firstOfPairStrand` | yes (read2 inverted by design) | yes                                   |
| `pairOrientation`   | yes (per-pair property)        | yes                                   |
| `strand`            | no (mates have opposite)       | no                                    |
| `supplementary`     | no (chain _contains_ both)     | no                                    |
| `mapq` / `duplicate`| no (per-read)                  | no                                    |

**Decision (confirmed): restrict chain-mode grouping to the three consistent
dimensions.** The whole point is that a chain stays in one group — HP-tag
haplotype grouping of linked/long reads is the primary target use case. The
alternative (allow all via representative semantics) is well-defined for a single
region but silently splits chains across region boundaries for per-read
dimensions, so it's excluded.

## Two latent bugs grouping would expose (fix as part of this)

**1. Chain indices become group-local → `buildChainIdMap` collisions.** Each
group's `buildChainMetadata` numbers its chains `0..n` independently, so group
A's "chain 3" is not group B's "chain 3". `buildChainIdMap`
(`groupedDataMaps.ts`) keys the hover/highlight expansion map by that raw integer
across all groups, so it would merge unrelated chains. **Fix: key
`buildChainIdMap` by chain _name_** (globally unique); `chainIdsForHit`
(`PileupComponent.tsx`) resolves the name via `rpcData.chainNames[chainIdx]`.
This also fixes a **pre-existing multi-region bug**: chainIdx is assigned per
worker call and is already not stable across regions — names are.

**2. Per-group insert-size domain.** `buildChainMetadata` computes
`insertSizeStats` per group, so long/short-insert read coloring would use a
different scale per section. **Fix (Phase 2 polish):** compute a shared
insert-size domain across groups on the main thread, the same trick coverage
(`coverageMaxDepth`) and samplot (`arcsYDomainBp`) already use.

## Implementation phases

### Phase 1 — worker partition (the unlock)

- `shared/groupFeatures.ts`: add `partitionChains(features, groupBy)` next to
  `partitionFeatures`, reusing the private `groupKeyFor` / `orderGroups`. Group
  features by name into chains, compute one key per chain from
  `chainRepresentative(chain)`, emit `FeatureGroup[]` (same shape, so the spine
  is untouched). Add `isChainGroupableType(type)`.
- `RenderAlignmentDataRPC/executeRenderAlignmentData.ts`: replace
  `const groupBy = isChain ? undefined : groupByArg` with
  `const groupBy = isChain && !isChainGroupableType(groupByArg?.type) ? undefined
  : groupByArg` (defensive: an old session with `strand` + chain degrades to
  ungrouped, never splits). Branch `isChain ? partitionChains(...) :
  partitionFeatures(...)`.
- No change to `buildGroupResult` / `buildChainResultFields` — they already run
  correctly per group.

### Phase 2 — fix the latent bugs

- `groupedDataMaps.ts`: `buildChainIdMap` keyed by chain name (reads
  `data.chainNames`).
- `components/PileupComponent.tsx`: `chainIdsForHit` resolves the name from
  `resolved.rpcData.chainNames[chainIdx]`, then `chainIdMap.get(name)`.
- Shared insert-size domain getter in `model.ts` → into `renderState`, consumed
  in the read shader's `insertUpper` / `insertLower` (mirror the `arcsYDomainBp`
  plumbing).

### Phase 3 — UI

- `dialogs/GroupByDialog.tsx`: when `model.isChainMode`, filter
  `STACK_DIMENSIONS` to the chain-consistent three (add a
  `CHAIN_STACK_DIMENSIONS` subset, mirroring the existing `SPLIT_DIMENSIONS`
  pattern). Add a one-line helper note ("In linked-read mode, grouping keeps each
  chain whole").
- Verify `setGroupBy` × `linkedReads` toggles (already orthogonal via
  `rpcProps`; no model gate exists today).

### Phase 4 — docs

- Update `LinearAlignmentsDisplay/CLAUDE.md` and `RenderAlignmentDataRPC/
  CLAUDE.md` to drop "grouping is pileup-only" and document the
  chain-consistent-dimension rule + the cross-region edge below.

## Test plan

- `shared/groupFeatures.test.ts`: `partitionChains` keeps every read of a chain
  in one group; representative-key selection; ungrouped fallback;
  disallowed-type guard.
- `groupedDataMaps.test.ts`: `buildChainIdMap` keyed by name unions a chain's
  reads across regions and never collides cross-group.
- `products/jbrowse-web/src/tests/AlignmentGroupBy.test.tsx`: new case —
  `linkedReads: 'normal'` + `groupBy {type:'tag', tag:'HP'}` → two sections, each
  chain's mates on shared rows within one section, connecting lines intact (image
  snapshot).

## Known limitation to document (not fix)

A chain spanning regions where the grouping tag is present on some mates but
missing on others can still split (each region keys its local reads from what it
can see). Consistent with the existing documented multi-region chain caveats
(`RenderAlignmentDataRPC/CLAUDE.md`); not worth main-thread re-resolution for v1.

## Decisions

- **Restrict to the three chain-consistent dimensions** (tag / firstOfPairStrand
  / pairOrientation). HP-tag haplotype grouping is the primary use case;
  keeping each chain whole inside one group is the whole point.
- **Defer the shared insert-size domain** (the Phase 2 polish bullet) — color
  scale comparability across sections is a nice-to-have, not required for the
  feature to work. Phase 2 still includes the `buildChainIdMap`-by-name fix,
  which is a correctness fix, not polish.
