---
name: synteny-hover-picks-the-wrong-feature-past-16-7m-instances
description: The synteny shaders carry `featureId` as a Float32, so past 2^24 instances in one RPC response adjacent ids collide and hover or click highlights the wrong ribbon. The fix is a uint attribute and uniforms; it waits on a real file that reaches the cap.
---

# Synteny hover picks the wrong feature past 16.7M instances

`instanceInterleave.ts` writes each instance's `featureId` through the Float32
view, and the shaders compare it to the `float` `hoveredFeatureId` and
`clickedFeatureId` uniforms (`shaders/syntenyTypes.slang`). Past 2²⁴ features
in one synteny RPC response, adjacent indices collide in Float32 and hover or
click highlights the wrong feature. Coordinates and colors stay correct;
`color` already goes through the `u32` view.

The cap does not depend on genome size: the corners are window-relative
Float32 against a fetch-time base
([ADR-067](../../architecture-decision-records/adr-067-synteny-dotplot-window-relative-float32.md)),
and the per-reference uint32 limit in
[BP_PRECISION.md](../../reference/BP_PRECISION.md) §"Genome-size limits" is a
separate one. Wheat (16 Gbp) stays far below it; a dense all-vs-all
whole-genome PAF is the likeliest file to reach it.

## The fix

Flip the `featureId` attribute and both uniforms from `float` to `uint` and
regenerate the `.iface`; the interleave buffer already has a `u32` view.

## Waiting on

A real file that reaches the cap, rather than fixing it speculatively.
