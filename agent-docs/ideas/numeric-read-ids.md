---
name: numeric-read-ids
description: readIds costs 33ms per query on the deepest short-read fixture — as much as the whole mismatch walk — building 153,677 template literals in the worker and structured-cloning them. Measured, scoped, and parked with the design and the one thing that makes it non-mechanical. Read before touching readIds or the alignments hit-test identity.
---

# `readIds` is a string per read, and it costs about what the mismatch walk does

Measured 2026-08-13, not implemented. The number is solid; the change is a
refactor across the hit-test identity, which is why this is an idea rather than
a commit.

## What it costs

`buildBaseFeatureData` puts `id: feature.id()` on every read — for the
alignments features that is `` `${adapter.id}-${fileOffset}` ``, a template
literal per read — and `buildBaseReadArrays` collects them into
`readIds: string[]`, which then structured-clones to the main thread with the
rest of the RPC result.

`plugins/alignments/benches/readIds.bench.ts`, `1000x.shortread.bam`, 153,677
reads, min of 25 rotated rounds, control 0.954x:

| | ships | numeric | |
| --- | --: | --: | --: |
| build | 24.49ms | 1.89ms (`Float64Array`) | 13.0x |
| post (structured clone) | 8.55ms | 0.21ms (transferred) | 40.8x |
| **total** | **33.04ms** | **2.10ms** | **15.8x** |

For scale, the whole mismatch walk on the same fixture is ~35ms. So the read
identity costs about as much as computing every mismatch the pileup draws.

Two independent halves, which is why both numbers are given: a fix that removes
the build but still posts 153k strings — or the reverse — buys about half. The
clone half is large for the reason
[REJECTED_IDEAS](../reference/REJECTED_IDEAS.md) already records for the
feature-details payload: structured clone is priced by object **count**, not
bytes, so 153,677 strings is 153,677 objects against one transferable.

`Float64Array`, not `Uint32Array`: a BAM virtual offset is
`(blockStart << 16) | inBlock`, which passes 2^32 on any file over ~64 GB and is
exact in a double to 2^53.

## The thing that makes it non-mechanical

The id is not purely internal. It reaches:

- `featureIdUnderMouse`, MST state on `LinearAlignmentsDisplay`, saved and
  restored (`model.ts` ~3518)
- `fetchFeatureDetails(self, featureId)` and `getFeatureInfoById`, which
  re-fetch the feature by that string
- `findFeatureInRpcData(featureId: string)` via `readIdIndexMap`

So the string has to keep existing at that boundary. **What saves the design is
that only one is needed at a time** — a hover or a click produces exactly one —
so it can be built on demand as `` `${prefix}-${recordId}` `` and never
materialised in bulk.

## Two shapes, and the safer one first

**A — lazy strings, no semantic change.** Worker sends
`readRecordIds: Float64Array` (transferable) plus `readIdPrefix: string`, and
drops `readIds`. Every consumer moves from `data.readIds[i]` to a
`readIdAt(data, i)` helper, and the two bulk consumers
(`groupedDataMaps`'s two maps) materialise through a `WeakMap`-memoised
accessor keyed on the data object. Ids stay strings everywhere they are
observed, so hit-testing, MST state and the details fetch are untouched.

Saves the full 33ms on any render that never asks for an id — which is most of
them, since `lazyReadIdToIndex` is already deferred — and costs today's price
when something does.

**B — numeric identity throughout.** The maps key by number, and the string is
built only where it escapes. Strictly better, and it changes `sortLayout`'s
canonical tiebreak from a string compare to a numeric one, which is a real
ordering change with a 1,291-line test file over it.

Do A first. B is a follow-on that A does not block.

## Consumers to move (8)

`features/linkedReads/computeOverlay.ts`, `features/read/buildRegion.ts`
(already lazy), `features/read/hitTest.ts`, `features/softclip/hitTest.ts`,
`features/arcs/compute.ts`, `LinearAlignmentsDisplay/computeChainLayout.ts`
(length only), `LinearAlignmentsDisplay/groupedDataMaps.ts` (both bulk maps),
`RenderAlignmentDataRPC/sortLayout.ts` (worker-side tiebreak). Plus
`RenderAlignmentDataRPC/types.ts`, and the `testPileupData` / `testUtils`
fixtures — which per that directory's CLAUDE.md must be extended rather than
cast around.

`buildChainMetadata` also keys `featureIdToChainIdx` on `f.id`; it wants the
read's index or its numeric id, not the string.

## Why it was parked rather than done

The measurement is unambiguous and the design above is settled. What is not
settled is verification: the change lands on hover, click, feature details and
MST state save/restore, none of which the unit suite exercises end to end, and
the browser gate is the slow and flaky one
([CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md)). It wants a
session that can drive the real app, not one that can only run jest.
