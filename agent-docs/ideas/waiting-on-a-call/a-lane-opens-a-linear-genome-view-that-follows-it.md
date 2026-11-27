---
name: a-lane-opens-a-linear-genome-view-that-follows-it
description: A multiway lane hosts one annotation, so a reader wanting a real track on its genome opens a separate view that does not follow the anchor. An "Open ⟨assembly⟩ at the matching region" that follows the lane's frame gives a full LGV drill-down.
---

# A lane opens a linear genome view that follows it

A `MultiWaySyntenyDisplay` lane hosts one annotation plus the layers
[ADR-180](../../architecture-decision-records/adr-180-a-multiway-lane-is-a-layer-list-under-its-frame.md)
draws through its frame. A reader who wants a real track on some genome has the
lane header's open and re-anchor items (`mateLaneGoItems` in
`MultiWaySyntenyDisplay/menus.ts`); the opened view then stands still while the
anchor moves.

## The proposal

"Open ⟨assembly⟩ at the matching region", made to FOLLOW the lane's frame. A
lane decision is already `{pivotAnchor, pivotLaneBp, rung, flipped}`, and
`SyntenyFollow` already navigates a real LGV from pairwise data, so the lane
stack stays the overview and the drill-down is a full LGV that tracks the lane.

Per-lane pan and zoom stay absent by design: the lanes re-fit to the anchor's
viewport, and a launch to a linear synteny view is the route to a lane the
reader drives.

## Out of scope

A hub layout in `LinearSyntenyView`, every level anchored on one row, is a view
redesign, since a level is the gap between `views[i]` and `views[i + 1]` in ten
files. The repeated-anchor launch (**Repeat ⟨anchor⟩ between panels**) covers
the star.

## The call

Whether a followed view is worth a second follow target beside the synteny
view's panels, and what it does when the lane's decision flips contig.
