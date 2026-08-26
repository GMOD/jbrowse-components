---
name: unsnapped-fetch-windows
description: LD and the multi-sample variant matrix ask the adapter for the raw viewport, where every other fetch in the tree buffers by half a screen, snaps to block boundaries or snaps to a grid — so a one-pixel pan refetches a full pairwise LD matrix. Both are deliberate and one is pinned by a test, so closing it means measuring the cost and deciding what a viewport-defined dataset is allowed to do, not fixing a bug.
---

# Two fetches ask for the raw viewport

Six spellings of "which regions does this fetch ask for" exist in the tree, and
four of them keep a pan from refetching:

| window | who |
| --- | --- |
| `bufferedVisibleRegions` — visible plus half a screen, clamped per region | the per-region default: canvas, wiggle, alignments, MAF, sequence, GWAS, regular variants |
| `staticBlocks.contentBlocks` — snapped to block boundaries | arc, HiC, multi-way synteny, the breakpoint overlay |
| `syntenyFetchRegions` — visible plus `syntenyPanBufferPx`, snapped outward to a grid | synteny, dotplot |
| `displayedRegions` — the whole genome, so nothing to snap | the circular chord fetch |
| **`dynamicBlocks.contentBlocks` — the exact viewport, fractional bp** | **LD** |
| **`visibleRegions` — the exact viewport, integer-rounded** | **the variant matrix** |

The last two are the subject. A dynamic block's key carries the fractional bp of
the visible window, and `calculateDynamicBlocks` recomputes per animation frame
during a drag — `ARCHITECTURAL_LIMITS.md` records that it cannot take
`staticBlocks`' memo, because its answer *is* the viewport. So LD's
`viewSignature` is a new string every frame: `dataCurrent` and `svgReady` stay
false for a whole gesture, and every settled viewport issues another full
pairwise matrix, each superseding the last.

## Both are deliberate, and one is pinned

`LDDisplay/shared.ts` says why: LD's SNP set is viewport-defined, since the
index-mode triangle spans the visible blocks, so a pan genuinely refetches.
`MultiSampleVariantBaseModel` says the same for matrix mode — its columns lay
out by feature index across the visible width, so a buffered feature would be
crammed into the viewport and draw a connector to an off-screen position.

`staleSignature.test.ts` pins the LD behaviour directly: a 137 px pan leaves
`dataCurrent` false. Changing the window means changing that test, which is the
signal that this is a cost argument rather than a defect.

## What makes it worth measuring anyway

Neither comment addresses **granularity**. "A pan refetches" and "every pixel of
every pan refetches" are different claims, and only the first is argued. A
one-pixel pan changes the block keys without changing which SNPs are visible.

The machinery for the fix already exists on both sides. `syntenyFetchRegions`
snaps a buffered window outward to a grid precisely so a sub-buffer pan produces
a byte-identical window, and it is a plain function over visible blocks,
displayed regions, width and `bpPerPx` — nothing in it is specific to synteny.
On the render side, LD's payload is already positioned genomically: the fetch
sends an origin, `viewTransform` folds it back per frame, and `columnX` rescales
the fetch-time column width to the live viewport, which is exactly what
`staleSignature.test.ts` demonstrates when it lets the stale triangle draw
correctly under a moved viewport.

## What has to be decided, not just measured

- **Does an index-mode layout survive a superset window?** LD in index mode and
  the variant matrix both lay out by feature index across the visible width. A
  snapped window contains features the viewport does not show, so either the
  worker culls to the visible span before numbering columns, or the layout has
  to become genomic. That is the real question and it is a design one.
- **Where would the shared window primitive live?** `syntenyFetchRegions`,
  `fetchWindowSignature`, `regionSignature` and `bucketBpPerPx` sit in
  `packages/synteny-core`, which today only the comparative plugins import — the
  correct home while every consumer is comparative. An LGV display reaching into
  it is the wrong direction, so this move is a precondition of the fix rather
  than a standalone cleanup; `packages/synteny-core` and `packages/display-kit`
  both sit on `@jbrowse/core`, where `isDataCurrent` and `installFetch` already
  live.

## Measure first

Count the RPCs a slow one-screen drag issues on an LD track and on a variant
matrix, against the same drag on a wiggle track for the buffered baseline.
`reference/INTERACTION_PERF.md` has the harness conventions. If the count is
already near one, the granularity argument is wrong and this belongs in
`reference/REJECTED_IDEAS.md` with the numbers.
