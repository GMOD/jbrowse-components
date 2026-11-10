---
name: a-link-places-a-foot-in-its-own-region-at-any-index
description: In a view of more than 256 displayed regions, a link arc in region 256 or later draws a stem and a read connector there is hidden, since both shaders place even an own-region far foot through a 256-entry table.
---

# A link places a foot in its own region at any index

`linkMark.slang` places the near foot through `ownEntry`, which works at any
displayed region index, and the far foot through `regionTable[x2Region]`,
which holds `LINK_MAX_REGIONS` (256) entries. `e.placed` is
`x2Region < regionCount`, so a pair whose far foot is in its OWN region still
draws a stem once that region's index is 256 or more. The JS twin in
`linkMark.ts` applies the same test twice, in `placeCurve` and `reachesX`.

`connectorMark.slang` shares the table (`viewRegionUniforms`) and the test, and
sends an unplaced connector off clip, so a read connector there is not drawn at
all. Its JS twin `placeConnector` has no 256 test, so Canvas2D and the hit test
still place what the GPU hides.

Reaching it takes a view of more than 256 displayed regions: a draft assembly
shown whole, then a search for a late scaffold, which moves inside the
displayed regions and keeps them. The read-connections band has had the limit
since [ADR-170](../../architecture-decision-records/adr-170-the-read-connections-band-is-a-marks-list.md);
sashimi gained it in
[ADR-222](../../architecture-decision-records/adr-222-sashimi-arcs-are-link-marks.md),
where the SVG overlay had none. A `link` layer of the marks display feeds the
same shader through `linkOwners.ts`.

First move: window the table on the drawing block. `viewRegionUniforms` gains a
`regionBase` near the block's own index less half the table, `fillTable` writes
`regions[base .. base + 256)`, and both shaders test
`x2Region - regionBase < regionCount`, where unsigned wrap rejects an index
below the base and both sentinels. The own region is inside the window by
construction, and so are its neighbours, which a test of
`x2Region == own index` would leave as stems: a mate on the next scaffold is
the arc a draft assembly is opened for. One predicate for "the table holds this
region" then serves `placeCurve`, `reachesX` and `placeConnector`. A far foot
more than half a table away still draws a stem.

Nothing pins the stem at index 256 today, and the vertex stage's placement has
no JS parity test, so the fix wants a `placeCurve` case with both feet in
region 300 and a real-GPU capture.
