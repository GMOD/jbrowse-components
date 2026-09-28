---
name: wiggle-onto-bar-and-point
description: Move wiggle's xyplot and scatter onto render-core's bar and point marks. The line (ADR-184) and the pivot as a shader-side threshold over the plotted value (ADR-185) landed 2026-09-28, and a constant colour rides as one number on the layer (ADR-198). Two blockers remain — markColor.slang has no symlog, and wiggle holds one row per source where bar and point read a row lane per instance — and the call left is whether `row` may ride as a per-layer constant the way colour now does. Sized at 7-10 days.
---

# Wiggle's xyplot and scatter onto `bar` and `point`

Moved out of `handoffs/grammar-next-steps.md` on 2026-09-27, where a review that
day sized it; nobody has re-measured the sizes.

## What is already out of the way

Of the four blockers sized on 2026-09-26, the bin-midpoint one is gone (ADR-181
centres a point), the interleaved positions live only in the payload
(`plugins/wiggle/src/util.ts`; the GPU record already matches `bar`'s x/x2),
and the row's f32-against-u32 is about an hour. Since then the line landed as
a mark (ADR-184), and the bicolor pivot is a threshold over `y` resolved in the
shader (ADR-185): a rise across the pivot changes colour at it, the colour
costs no lane because it reads the `y` lane, and a pivot edit refetches
nothing. The density heatmap is a `span` under a colour scale (ADR-113's
2026-09-28 amendment), the white fade a diverging `range` with `domainMid`.

## What is still real

- `markColor.slang` has no symlog.
- Wiggle holds one row per source where `bar` and `point` read a `row` lane
  per instance. ADR-165 stage 2's row table already gives them a per-row
  colour.

## The call

Whether a layer may carry a per-source constant, or wiggle fills constant
arrays at pack time. For colour it is answered:
[ADR-198](../../architecture-decision-records/adr-198-a-constant-colour-rides-as-a-scalar.md)
lets `EncodedChannels.color` be one number, which the GPU pack expands for the
pack alone and Canvas2D expands once, so a constant-colour bar holds wiggle's
12 bytes a feature. `row` is the same question one lane over: a multi-wiggle
source is one layer standing in one row, and a `row` lane repeats that number
per instance (ADR-152's third condition). The same union, `Uint32Array |
number` read through a `rowAt`, would answer it the same way; `rowLane`
already fills zeros at pack time for a layer with none.
[wiggle-instance-records-carry-per-row-constants](../ready/wiggle-instance-records-carry-per-row-constants.md)
measures the same per-row constants from the GPU side.

## First step once answered

Un-interleave the positions: 1-1.5 days, about 25 files, no pixels moved, held
by `wiggleInstanceBuffer.test.ts` and the pack benches at 1.00x or better.
