---
name: a-link-places-a-foot-in-its-own-region-at-any-index
description: The link shader's region table holds 256 entries and a far foot is placed through it even when it lies in the instance's own region, so in a view of more than 256 displayed regions a sashimi junction or a read-connection arc inside region 256 or later draws a stem.
---

# A link places a foot in its own region at any index

`linkMark.slang` places the near foot through `ownEntry`, which works at any
displayed region index, and the far foot through `regionTable[x2Region]`,
which holds `LINK_MAX_REGIONS` (256) entries. `e.placed` is
`x2Region < regionCount`, so a pair whose far foot is in its OWN region still
draws a stem once that region's index is 256 or more. The JS twin in
`linkMark.ts` (`placeCurve`) applies the same test.

Reaching it takes a view of more than 256 displayed regions, a draft assembly
shown whole, zoomed to a late scaffold. The read-connections band has had the
limit since [ADR-170](../../architecture-decision-records/adr-170-the-read-connections-band-is-a-marks-list.md);
sashimi gained it in
[ADR-222](../../architecture-decision-records/adr-222-sashimi-arcs-are-link-marks.md),
where the SVG overlay had none.

First move: treat `x2Region == own index` as placed through `ownEntry` and
`ownSpan`, in the shader and in `placeCurve`. The shader needs the block's own
index, which rides no uniform today.
