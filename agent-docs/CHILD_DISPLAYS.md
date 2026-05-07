# Child Displays — Per-Group Alignments via Composition

Plan for implementing virtual group lanes (per-haplotype, per-strand, per-RG)
with full per-group feature parity (coverage, SNP frequencies, sashimi, sort,
autoscale, hover) without exploding the complexity of the alignments display.

## Problem

We want a track that splits reads by a tag (e.g. `HP`) into N stacked lanes,
each showing its own coverage bar with SNP frequencies, like N session tracks
stacked together — but with a single shared BAM fetch.

The first attempt was to teach the existing renderers/layout/coverage about
groups: add a `groupBy` field, partition coverage data per group, add a
per-group draw pass loop in both Canvas2D and GPU renderers, recompute Y-row
math with `coverageRows` per group, recurse `collectTransferables` into a new
`groupCoverages` field. This approach was reverted because it spread per-group
branching across every subsystem, and every future feature would also have to
learn about groups.

## Wrong factorization

The Phase 3 plan asked N+1 subsystems (Canvas2D renderer, GPU renderer, layout
packer, coverage pipeline, hit-test, autoscale, scroll math, sashimi, mismatch
overlays) to each gain a per-group code path. Even with each branch small, the
surface area is enormous and grows with every new feature. Session-tracks has
zero of this complexity because each track is a self-contained instance — the
per-group dimension is composition, not branching.

## The reframe

> A single track contains N **virtual child displays**, each one a full
> `LinearAlignmentsDisplay` instance, sharing only the fetched data.

This is session-tracks done right: same conceptual model, but the children live
inside one track shell and share the BAM fetch. Every renderer, every overlay,
every feature works in groups automatically because each child IS a regular
display. The display's internals never learn about groups.

## Architecture

```
LinearAlignmentsDisplay (shell)
├── one BAM fetch — owns rpcDataMap (parent-level)
├── groupBy?: { tag, values }
└── children: ChildDisplay[]   ← N when groupBy active, 1 otherwise

ChildDisplay (real MST model, mirrors LinearAlignmentsDisplay's pileup-side)
├── filtered feature view (groupTagValues[i] === myValue)
├── runs existing layout, coverage pipeline, renderer, hit-test on its slice
├── owns its own height, autoscale, sort order
└── renders into its own canvas DOM nodes, exactly like a session track
```

The view becomes:

```jsx
{model.children.map(child => <PileupBlock model={child} />)}
```

Shell stacks children with dividers. PileupBlock is the existing pileup
renderer, untouched.

## What this buys

| Concern from Phase 3 plan                            | Child-displays |
| ---------------------------------------------------- | -------------- |
| Per-group `coverageRows` Y-stacking                  | Each child has its own height — stacking is CSS flex |
| GPU `saveUBO`/`drawPass` loop per group              | Each child has its own GPU pass with its own uniforms (already how regions work) |
| Canvas2D translate/clip per group                    | Each child has its own canvas DOM element |
| `groupCoverages: GroupCoverageData[]` data type      | Coverage data is `child.coverageData`, same as today |
| `collectTransferables` recursion                     | Worker returns `Map<groupValue, PileupDataResult>` — one level deep, mechanical |
| Per-group autoscale, SNPs, sashimi, hover, sort      | Free. Children are full displays. |
| Future feature X must learn about groups             | Works in groups by construction |

## Where the bodies are buried

**1. ChildDisplay is a real MST model.** Conflicts with the "flat over nested"
rule, but that rule is about modularizing one logical model into pieces. This
case has true instance multiplicity — N copies of the same thing. That's
exactly what nested MST is for.

**2. Feature distribution.** Parent worker fetches once, returns
`Map<groupValue, PileupDataResult>` instead of one result. Worker partitions by
`groupTagValues[i]` after `extractFeatureArrays` — single O(N) pass on
already-parsed arrays, no re-CIGAR. Each child's `rpcDataMap` is fed its slice.

**3. Shared vs. owned config.** Children inherit colorBy/filterBy/sortedBy/
showCoverage from parent. `setColorBy` on parent fans out to all children (or
children proxy to parent's config). Needs a consistent rule —
probably "config lives on parent, all children read from parent." Get this
wrong and there are stale config bugs forever.

**4. Hit testing & menus.** Mouse y → which child → child's hit test. Track
menu items live on parent. Per-child track menu items (e.g. "sort this group
by...") need a UX decision.

**5. Single-display-when-no-groupBy case.** When `groupBy` is null, we want
exactly one child that behaves identically to today. Either: parent always has
children (one when ungrouped), or parent has special "self-rendering" mode.
The first is cleaner — always children, always loop.

## Scope

Higher upfront cost than the Phase 3 plan: ~700–900 LOC. Most of it is the
ChildDisplay MST model and config plumbing.

Much lower marginal cost forever after. No per-feature taxes. No "and now make
sashimi work in groups" follow-ups.

## Tradeoff matrix

| Approach                       | Upfront cost | Per-future-feature cost | Conceptual cleanliness |
| ------------------------------ | ------------ | ----------------------- | ---------------------- |
| Session tracks (today)         | 0            | 0                       | High (independent tracks) |
| Phase 3 plan (renderers learn groups) | ~600 LOC | Medium-high (every new feature taxes group paths) | Low (groups bleed into every renderer) |
| Child-displays                 | ~800 LOC     | 0                       | High (groups are composition) |
| Session-track sugar (alt)      | ~50 LOC      | 0                       | Highest — but doesn't solve fetch sharing |

## Recommendation

If per-group is a first-class feature with full parity: **child-displays**.
The only design where complexity stays bounded.

If single-fetch sharing is not required: **add a "Group as session tracks" menu
item**. Creates N filtered session tracks, ships in ~50 lines. Every feature
works forever at zero cost. The single fetch is the only thing this gives up.

## Suggested first step

Spike the child-displays shape — MST skeleton + one passthrough getter — to
see the actual shape before committing to the full implementation.
