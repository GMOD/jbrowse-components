---
name: a-synteny-group-id-gives-a-block-one-identity-across-rows
description: A synteny feature knows only its one `mate`, so a block in a view of several genomes cannot keep one color, highlight in every row on hover, or be filtered to "present in all". An optional adapter-provided `syntenyGroupId` beside `mate` gives all three.
---

# A synteny group id gives a block one identity across rows

Synteny features are strictly pairwise: one `mate`
(`{start,end,refName,assemblyName}`) per feature, and no shared block or anchor
id anywhere in `comparative-adapters` or `synteny-core` (PAFAdapter's
`uniqueId` is the row index).

## The proposal

An optional adapter-provided `syntenyGroupId` (block or anchor id) *alongside*
`mate`, not replacing it. It is an identity overlay, not a new render unit, so
the pairwise geometry the linear layout needs stays as it is. It gives:

- one color per block across every row it touches (`color: { field: 'group' }`,
  hash the id in `syntenyColors.ts`, a main-thread recolor with no RPC)
- hover one, highlight the block in every row
- "present in all N" filtering

`MultiWaySyntenyDisplay`, which groups on gene name with `syntenyId` as the
nameless fallback, would be its third consumer.

## Sources

- MCScan: an `.anchors` pair has its block already, as `block` beside
  `blockSpan`
  ([ADR-281](../../architecture-decision-records/adr-281-a-sources-blocks-draw-under-its-gene-pairs.md)),
  but numbered per file, so not yet an id shared across rows. Start here.
- MAF has block structure that could populate it.
- PAF (independent lines) leaves it undefined.

## What it does not do

It does not draw a ribbon that skips a row (a block present in A and C but
rearranged out of B). The transitive A→B→C case is already visible through the
middle row, so this matters only for a genuine A–C record with no B
intermediary. That needs the renderer to connect same-group segments by row
order rather than by a fixed adjacent `mate`, and a level that references two
non-adjacent views. `buildSyntenyGeometry` and
`executeSyntenyFeaturesAndPositions` already take any two `SyntenyViewSnap`s;
adjacency is wiring (`views[level]`/`views[level+1]` in
`LinearSyntenyDisplay/afterAttach.ts` and the `connectedViews` getter). So it
is a level-model and z-ordering change, a separate and larger step, and the id
is its prerequisite. Chained blocks as a data source are
[block-level-synteny-from-external-tools](../ready/block-level-synteny-from-external-tools.md).

## The call

Whether a cross-row identity is worth a new adapter field before a user asks
for block-consistent color, and whether a per-file MCScan block number is made
global or a new id is minted.
