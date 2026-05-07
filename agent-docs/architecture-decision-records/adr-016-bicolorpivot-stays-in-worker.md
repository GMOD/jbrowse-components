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

The upload autorun (spawned by `GpuBackendLifecycleSlotMixin.installGpuDisplay`)
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
