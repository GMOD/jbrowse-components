---
name: give-the-interchromosomal-ticks-breakend-feet-too
description: an interchromosomal arc draws a direction-bearing foot at each end and an off-screen-partner tick draws none — unfinished rather than declined, and about a day through a per-instance direction attribute, `arcLine.slang`, the Canvas2D mirror and the SVG export
---

# Give the interchromosomal ticks breakend feet too

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. Unfinished, not wrong: a tick that says nothing about
direction is worse than one that does, and no worse than the last release's.

An interchromosomal arc draws a foot at each end — a short horizontal tick lying
over the sequence that end keeps, so outward reads as a deletion-type junction,
inward as a duplication-type and parallel as an inversion
(`features/arcs/mark.ts`, `arcPath.ts`, and
[reference/ARC_BAND.md](../reference/ARC_BAND.md):296, whose `:352` also has the
foot's unconditional length). An interchromosomal connection whose partner is
**off screen** draws as a pair of TICKS instead, and those have no feet.

That is unfinished, not declined. A tick means "the partner is somewhere you
cannot see", and the direction at the near foot is exactly as informative there
— arguably more, since there is no second endpoint to read the orientation off.

It was left out because the two draws are not the same kind of thing. The feet
live in the SVG cross-region overlay, which re-traces `arc.mark` in TypeScript;
`arcLine` is a GPU/Canvas2D pass. So this one needs a per-instance direction
attribute, geometry in `arcLine.slang` plus `pnpm gen:shaders`, the Canvas2D
mirror, the SVG export, and a decision about whether a foot is part of the
tick's hit-test target. Roughly a day. Nothing in the landed arc work blocks it,
and `LinearAlignmentsDisplay/components/arcBreakendFeet.test.ts` exists now,
which is where a tick-foot direction assertion lands.

The direction itself is already computed and already correct for this case:
`readTrailingBodyDir` is a property of the junction rather than of the read, so a
tick coalescing several reads on one coordinate has one answer — but note that a
`ComputedLine` deliberately carries none today, and two junctions sharing a
breakpoint would otherwise take whichever read arrived first. Decide that before
packing a direction into the tick buffer.

Whichever direction a tick's foot ends up taking, it is the OFF-SCREEN-partner
case, so `pairOuterDir`'s distinction applies to it too: the mate-link producers
answer with the read's direction negated, because their endpoint is the
fragment's outer edge rather than the junction.
