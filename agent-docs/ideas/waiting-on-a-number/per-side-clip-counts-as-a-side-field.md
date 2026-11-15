---
name: per-side-clip-counts-as-a-side-field
description: The clip indicator pools left and right clips, so its hover cannot say whether a breakpoint's pile is one-sided or two. A `side` field on the interbase event, set in the worker, would let the hover table split rows by it; count how often the two sides disagree at real breakpoints first.
---

# Per-side clip counts as a `side` field

The coverage band's clip indicator counts left and right soft clips at a
position under one `softclip` key (`LinearAlignmentsDisplay/components/positionStats.ts`).
Whether the reads at a breakpoint are anchored on one side of it or both is
visible in the pileup, but not in the hover.

## The shape

- A `side` field on the interbase event, set per clip in the worker, which the
  hover table splits rows by: "left-clipped n / right-clipped m".
- It cannot be derived on the main thread under SV channels. With a drawn-read
  filter the hover reads `sampleEvents`, whose `interbaseReadIndices` index the
  sample, while `readPositions` ships for drawn reads only
  (`RenderAlignmentDataRPC/executeRenderAlignmentData.ts`,
  `shared/drawnReads.ts`).
- Apart from any consensus. A per-side clip consensus is the kind of analysis
  [ADR-140](../../architecture-decision-records/adr-140-sv-analysis-is-not-ours-to-ship.md)
  leaves to established tools, and the clip strings it would read no longer
  ship:
  `interbaseSequences` carries `''` for clips. "Launch → BLAT soft-clipped
  bases" is the route to a clip's sequence.

## The number that decides it

At a set of called breakpoints, how often the two sides' clip counts differ
enough that pooling them misstates the event (a one-sided pile read as a
two-sided one). If pooled counts rarely mislead, the pileup already answers.
