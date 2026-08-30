---
status: Accepted
summary: "`bicolorPivot` split stays in the worker, not `gpuProps`"
---

# ADR-016: bicolorPivot split stays in the worker, not gpuProps

## Status

Accepted

## Context

`bicolorPivot` is a user-configurable threshold that splits wiggle features into
positive (score ≥ pivot) and negative (score < pivot) groups so each can be
drawn in a different color. The split runs inside `processFeaturesFromArrays`
in the RPC worker, and `bicolorPivot` is part of `rpcProps()`, which means
changing it triggers a full refetch.

The refetch seemed wasteful: the raw BigWig bins don't change when only the
color split threshold moves. This prompted a proposal to move the split to the
main thread inside `buildSourceRenderData` and put `bicolorPivot` in `gpuProps`
(re-upload only, no refetch). The change was implemented and then reverted after
performance analysis.

## Problem with main-thread split

The upload autorun (spawned by `RenderLifecycleMixin.attachRenderingBackend`)
fires when **any** entry in `rpcDataMap` changes — i.e., whenever any region
finishes loading. When it fires it iterates all current entries and calls
`buildSourceRenderData` for each. Moving the split there means the autorun
re-splits **every cached region** on each region arrival.

For wiggle data, millions of data items can flow through the pipeline. With N
cached regions each containing K features, every new-region arrival triggers
O(N × K) main-thread work instead of the worker's O(K) per-region at fetch
time. This increases main-thread pressure proportionally to total data volume,
causing jank during loading.

The worker split, by contrast, runs once per region at fetch time and the result
is stored in `rpcDataMap`. The upload autorun reads the pre-split arrays at
zero additional cost.

## Decision

Keep `bicolorPivot` in `rpcProps()` and the pos/neg split in
`processFeaturesFromArrays` (worker side).

The refetch cost is proportional to how often the user changes the threshold.
In practice `bicolorPivot` virtually never changes after initial track setup.
The main-thread split cost is proportional to data volume and fires on every
region arrival — a much hotter path.

## General rule

For a setting that:

- feeds into an expensive per-feature loop in the worker, AND
- changes rarely in practice,

the `rpcProps()` → refetch path is acceptable even though it looks wasteful. The
refetch is user-triggered and infrequent; the main-thread alternative would
execute on every upload autorun fire.

Only move worker computation to `gpuProps` when the setting changes frequently
(e.g., color choice, scale type) **and** the per-feature work is either cheap
or can be expressed as a uniform/shader parameter rather than a full array
re-scan.

## Rejected alternative

Move split to `buildSourceRenderData` on the main thread; put `bicolorPivot`
in `gpuProps`. Implemented as a branch, reverted: O(total cached features)
main-thread work per region arrival unacceptable at realistic data volumes.

## Corollary: the cost this measured is now a standing property of `gpuProps`

**Added 2026-08-30.** "O(N cached regions x K) main-thread work per region
arrival" is not only what the rejected branch would have cost — it is what
`installUpload` does today whenever `gpuProps()` identity moves
(`packages/render-core/src/installUpload.ts:195-198`: `p !== lastProps` clears
`encodedFrom`, so every cached region re-encodes). Most of what moves it —
colour, plot type, summary score mode, re-sort — does **not** refetch, so that
path has no network cost to make it visible.

Two consequences for anyone applying this ADR's rule:

- **`bicolorPivot` is in `gpuProps()` as well as `rpcProps()`**, and the second
  copy is not a violation of this decision. The worker still owns the avg-path
  split; the encoder needs the same threshold because the whiskers bands are
  coloured main-thread, and the SVG export calls `buildSourceRenderData(data,
  gpuProps)` directly. `buildSourceRenderData.ts:112-116` carries the reason.
- **The mirror-image proposal meets the same accounting from the other side.**
  Moving wiggle's instance packing *to* the worker (`ideas/zoom-perf-followups.md`)
  is this ADR's preferred direction — O(K) per region at fetch time — but the
  encoder cannot leave, only be duplicated, because the no-refetch re-encodes
  above still have to be served main-thread. This ADR does not forbid that move;
  it supplies the arithmetic for pricing it.

The "General rule" above is unchanged, and is still the one to apply.

## Corollary: per-source color does not collapse the pos/neg split

Because the split is worker-side and unconditional, a multi-wiggle source's
per-row color (`buildSourceRenderData`) only recolors the **positive** side in
row mode; the negative side keeps the shared `negColor`. This is deliberate —
signed data stays a readable pos/neg bicolor plot. Overlay mode is the one
exception: it reuses the pos color for neg so overlapping sources read as one
color. This has been proposed as a "bug" and rejected repeatedly; do not change
row-mode neg coloring to follow the per-source color.
