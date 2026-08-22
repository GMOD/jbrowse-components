---
status: Accepted
summary: "Pileup/chain row layout stays on the main thread; the packing cost it is blamed for is separable and is the thing to attack"
---

# ADR-053: Alignments row layout stays on the main thread

## Status

Accepted. Consolidates a decision already made once — find the commits by
message, not hash (agents rebase each other in this worktree): "No layout on
worker for alignments", then "refactor: derive alignments pileup layout via
getter; restore tag sort", which replaced the layout autorun with the derived
`laidOutPileupMap` getter. Re-proposed several times since. Read this before
proposing that `sortLayout.ts` / `computeChainLayout.ts` move into
`RenderAlignmentDataRPC`'s worker.

## Context

The worker returns per-read arrays with `readYs` zero-filled; the main thread
assigns rows (`sortLayout.ts` for pileup, `computeChainLayout.ts` for chains) and
`cloneWithLayout` propagates each read's row onto every per-feature `*Ys` array.
The GPU renderer then packs the row-instanced passes from those arrays.

That packing is main-thread work proportional to fetched depth, and it shows up
in traces as `pack*` self-time. The recurring proposal is to move layout into the
worker so the worker can pack too. It keeps coming back because the diagnosis
("this work should not be on the main thread") is correct while the proposed cure
targets the wrong half.

## Decision

Layout stays on the main thread. Four properties depend on it, and none survives
the move:

1. **A read's row is shared across displayed regions.** `computeMultiRegionLayout`
   joins by read id across every loaded region so a read spanning a boundary sits
   on one row in both; chain mode does the same by chain name, and a chain can
   span refNames. Each worker call sees **one** region, and regions arrive
   independently, so no worker can see the union that row assignment needs. This
   is not a corner case — a collapsed-intron view splits one chromosome into many
   displayed regions.

2. **The row cap is display geometry.** `maxRowsFor(maxHeight, rowHeight)`, the
   grouped fit budget (`fitGroupMaxRows`), per-group height overrides and
   collapse state all bound how many rows a group lays out. Sending them to the
   worker makes each a **tier-1 refetch key**: a track-height drag, a compact/
   normal flip or a group expand would re-read the BAM. The whole point of the
   tier system (`plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md`) is
   that these settings recompute without a round trip.

3. **Sort position is free today because layout is local.** The RPC carries
   `sortTag`, never the full `sortedBy` — moving the sort position within a tag
   sort re-lays-out and refetches nothing (`RenderAlignmentDataArgs.sortTag`).
   Worker-side layout puts the sort position back in the cache key.

4. **Stale data stays drawable.** ADR-006 keeps `rpcDataMap` through a refetch,
   which works because the payload is bp-space and layout is re-derived
   main-thread. Rows baked in the worker would be stale in exactly the frames
   that ADR exists to cover.

ADR-035 records a fifth consequence already relied on elsewhere: the worker
cannot know which reads overflow the row cap, because it does not know the rows.

## What to attack instead

The layout pass and the **pack** are separable, and it is the pack that is large.
`Y` is the only layout-dependent field in most instance structs, so the worker
can pack everything else — the same split that already sends coverage / SNP /
interbase / indicator bytes pre-packed. Three routes (worker packs with `y = 0`
and the main thread patches one lane; Y as a second instance buffer; Y as a
per-read indirection the shader reads) are written up in
[TODO.md](../TODO.md#alignments-still-repacks-every-row-instanced-pass-on-the-main-thread),
with the measurement to do first.

Two cheaper wins on the same path have landed and are worth knowing about before
re-opening this: the renderer now skips regions whose payload is
reference-identical (the `uploaded` memo in `GpuAlignmentsRenderer`), and the
per-read color bake is its own computed downstream of layout, so a recolor no
longer re-places rows — see
[GPU_RENDERING.md](../reference/GPU_RENDERING.md), "skipping a region without
leaving stale buffers".

## Consequences

- `sortLayout.ts` and `computeChainLayout.ts` stay main-thread. Their cost is
  bounded by `layoutGroupRowCounts` skipping `cloneWithLayout` for the fit-height
  probe, and by the layout/color tier split.
- A future feature that needs cross-region rows (a new grouping, a new sort)
  belongs in the same place; don't split row assignment across the boundary.
- **Revisit if** the fetch shape changes such that one worker call owns every
  visible region *and* display geometry stops bounding the row count — i.e. a
  different display, not a refactor of this one.
