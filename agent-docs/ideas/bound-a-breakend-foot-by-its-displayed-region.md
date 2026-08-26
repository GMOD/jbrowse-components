---
name: bound-a-breakend-foot-by-its-displayed-region
description: `ARC_FOOT_PX` is 20 CSS px unconditionally, so a breakend within 20 px of a region seam draws part of its foot across a contig the junction has nothing to say about — and the obvious partner bound is wrong, was written, and was reverted
---

# Bound a breakend foot by its displayed region

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Long-standing, and the right bound wants a per-pan-frame
region projection measured against the two `bpToPx` calls it would join.

`ARC_FOOT_PX` is 20 CSS px from the anchor, unconditionally, and an
interchromosomal arc's two feet are in **different displayed regions** by
construction. So a breakend within 20 px of a seam draws part of its foot across
that seam, over a contig the junction has nothing to say about — and a foot's
whole content is "this much sequence is retained here".

Not hypothetical framing: a two-region view of a fusion exists to put both
breakends on screen, and a reader zoomed in on one puts it near an edge.

**The obvious version is wrong and was written and reverted.** Bounding a foot by
the OTHER foot's anchor (`min(ARC_FOOT_PX, 2 * rx)` when it points that way)
looks equivalent and is not: two feet pointing the SAME way must keep overrunning
each other, since they overlap precisely because both ends keep the same stretch
and the bar they merge into is that stretch drawn (`ARC_FOOT_PX` carries the
199 bp templated insert this was measured on). A partner bound clamps exactly
that case. `arcFeetPath.test.ts` pins it against the mistake.

The right bound is each foot's own region's screen extent, which means:

- the model projecting `displayedRegions[i]`'s `start`/`end` once per resolve,
  beside `reversedByRegion` in `crossRegionArcSections` — a per-pan-frame cost,
  so measure it against the existing two `bpToPx` calls per arc;
- a per-foot max length on `ArcFeet` rather than one number, since the two feet
  hit different edges;
- `screenFeet` resolving it, for the same reason it resolves `regionReversed`
  there: it is the layer that knows which region each foot came through.

Same shape as the tick entry above — the mark says a direction, and a mark that
says it on the wrong contig is worse than one that says nothing.
