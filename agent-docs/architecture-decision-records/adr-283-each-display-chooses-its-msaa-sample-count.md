---
status: Accepted
summary: "A display's WebGPU sample count is 1 or 4, chosen per display: derived from its passes' `//! coverage: analytic`, or stated. Alignments states 1 since its 4x target held 340 MiB; Hi-C, LD, wiggle and the tiled marks stay at 4"
---

# ADR-283: Each display chooses its MSAA sample count

## Status

Accepted (2026-10-30). Taken in three steps: the derivation (2d8a7fbe95,
2026-09-05), the residency measurement (a61b5f81dd) and the alignments flip
(b23fc6ce3e), both on 2026-10-30.

## Context

- `WebGPUHal` held one 4x multisampled color attachment per display, sized to
  the canvas and not the data: canvas device px x 4 samples x 4 bytes. At dpr
  2, one alignments track at 1266x840 CSS px prices at 64.9 MiB, eight
  ordinary GPU tracks at 109.7 MiB, and one track dragged to the canvas clamp
  at 316.5 MiB (`probe-msaa-resize-cost.ts`, 2026-08-22).
- The read-connection arcs it was bought for stopped needing it on 2026-08-01,
  when `arc.slang` (now `linkMark.slang`) began measuring each fragment's
  distance to the analytic curve and ramping its own alpha over one device
  pixel.
- WebGPU allows only 1 or 4 samples (gpuweb#4446 is the request to widen
  that), and the canvas texture has no implicit antialiasing, so 1 means no
  multisampled target at all.
- Those sizes were arithmetic over a texture descriptor until
  `scripts/gpu-pixels/probe-msaa-residency.ts` read `/proc/self/fdinfo`
  through Dawn's Vulkan backend on Linux Mesa. A 2532x8180 device px target,
  priced at 316 MiB, held **340 MiB once drawn**: in system memory on the
  Intel UHD 630 (i915) and in VRAM on the AMD discrete GPU (radv), against 80
  MiB for the one-sample canvas texture alone.

## Decision

- **The sample count is a per-display property**,
  `RenderingBackendOptions.sampleCount` (`createRenderingBackend.ts`).
  Omitted, `deriveSampleCount` gives 1 when every registered pass declares
  `//! coverage: analytic`, else 4. Registered, not drawn: an inactive pass
  that leans on MSAA holds its display at 4. `getOrBuildPipeline` keys on the
  count, so a display at 1 is never handed a pipeline built at 4.
- **The same count sets WebGL2's antialiasing.** `createHal.ts` passes it to
  `WebGL2Hal`, which asks for the context with `antialias: sampleCount > 1`
  (`webgl2Hal.ts`), so a display at 1 gets no antialiased drawing buffer on
  that rung either.
- **A `union` blend pipeline always builds at 1** (`deviceGpuCache.ts`), since
  a union pass draws into a layer of its own (`unionLayer.ts`), whatever the
  display's count.
- **A pass declares `//! coverage: analytic`** only when its fragment computes
  its own edge coverage, or pixel-snaps, and its hull is padded past its ramp
  on every side. `scripts/gpu-pixels/run.ts` scores a pass at 1 and at 4
  against a supersampled scene; that score decides the directive
  (`reference/GPU_SHADERS.md` §"Scoring a pass's pixels on a real GPU").
- **Derived to 1:** synteny, dotplot and the feature track, whose passes all
  declare it.
- **Alignments states 1** (`AlignmentsRenderer.ts`), though its coverage band
  and most pileup passes draw hard edges. It is the tallest display, so its
  target was the largest, and it pays for that: read tips and coverage-bar
  tops go hard, and a coverage segment under a device pixel draws whole or not
  at all where four samples gave a tint. A common allele is many px tall and
  keeps its value. Against four samples, `alignments-coverage-bar` scores 5.5
  / 4.8 / 2.7% at dpr 1 / 1.5 / 2 against 1.5 / 1.0 / 0.7%
  (`scripts/gpu-pixels/fixtures/alignments.ts`).
- **These stay at 4:**
  - **Hi-C and LD.** Every cell edge is a 45° diagonal shared with the next
    cell. Per-fragment alpha on both sides of a shared edge sums to 0.75 where
    1 is right, so analytic AA seams them, and at one sample the map is a
    staircase. Exclusive sample coverage is the one thing that draws them.
  - **Wiggle, by choice.** Its bars' vertical cuts and the density pass's
    edges go hard at one sample (`wiggle-xyplot-bars`, `wiggle-density`), for
    about 8 MiB on a single-row track at dpr 2. Bins tile, so the vertical
    cuts cannot ramp (`wiggle.slang`).
  - **`spanMark`, `barMark` and `lineStepMark`, and every display that
    registers one** (MAF and multi-way synteny among them), with the sequence
    track's `sequenceCell` and the score example's `score`. Their cells and
    bars tile, so ramping x seams them (`spanMark` 11.8 / 8.5 / 6.2% at one
    sample against 2.7 / 2.1 / 1.5% at four). Each shader's header gives its
    reason.
  - **The variant display**, whose rows draw at fractional y on four samples
    ([ADR-256](adr-256-variant-rows-draw-at-fractional-y-on-four-samples.md)).

## Consequences

- A new display defaults to 4 unless every pass it registers declares the
  directive, so adding one MSAA-leaning pass to a display at 1 raises it to 4
  silently. A display that must stay at 1 states it.
- Moving a display to 1 moves its WebGPU browser-test snapshots and the
  cross-backend gate's WebGPU arm on every tiled mark, so the snapshot update
  and a read of `crossBackendGate.ts`'s thresholds go in the same commit.
- Residency on a tile-based GPU (Apple Silicon, phones), where a discarded
  multisampled attachment may never leave tile memory, is unmeasured
  (`reference/ARCHITECTURAL_LIMITS.md` §"The MSAA target is the largest
  per-display allocation"). If it is memoryless there, the alignments flip
  buys nothing on those machines and its hard edges cost something.

## Rejected alternatives

- **Every display at 1, with Hi-C and LD opting in to 4**: it inverts which
  displays opt in, and needs someone to look at Hi-C at 1 first. Not taken.
- **Per-cell analytic AA on Hi-C and LD**: seams, found independently in both
  backends (`drawHicBlocks.ts`, `GPU_SHADERS.md`). The shape that could free
  them is one primitive per visible strip, with the cell index derived in the
  fragment, so no two cells are adjacent primitives. That is a rewrite of
  `hic.slang`, and nothing has costed it.
- **One device-wide MSAA scratch sized to the largest canvas**: it turns
  `sum(canvas)` into `max(canvas)` but adds a stored full-canvas resolve and a
  copy per display per frame, which on a tiler is the traffic MSAA's inline
  resolve avoids.
- **Alignments at 1 on a whole dpr only**: the count is read at construction,
  and browser zoom reaches a fractional dpr afterwards.
- **`lineStepMark` inking each quad by area**: a joint is up to four
  overlapping quads, and a dense line's edge pixels compounded under src-over
  (`mark-step-dense-flat` went from 39 / 45 / 36% off at four samples to 79 /
  62 / 62%). Reverted; its header holds the numbers.
