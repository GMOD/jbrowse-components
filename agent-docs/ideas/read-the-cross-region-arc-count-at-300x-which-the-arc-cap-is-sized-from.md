---
name: read-the-cross-region-arc-count-at-300x-which-the-arc-cap-is-sized-from
description: `CROSS_REGION_ARC_CAP = 600` is sized off an estimate — 13.6% cross-region on one seam of a ~30x sample, scaled twice by assumption — and reading the real number is one `crossRegion.length` off the model. What it does not decide is the picture: at that depth the reader's own lever drops 9138 of 9204 arcs, so the cap is a floor under the frame rate rather than a filter.
---

# Read the cross-region arc count at 300x, which the arc cap is sized from

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The entry's own text says a wrong number here degrades a
picture that is a wash of ink either way.

`CROSS_REGION_ARC_CAP = 600` (`features/arcs/crossRegionOverlay.ts`) is sized for
the same-chromosome multi-seam case, which is the one that is actually unbounded.
Its input is an **estimate**: 52 of 381 arcs (13.6%) were cross-region on one
seam of HG02768's inverted duplication, a ~30x paired-end sample, and that count
was then scaled by an assumed ~10x for depth and again for the number of seams.
Only the 30x half was measured.

Reading the real number is cheap — `crossRegion.length` off the model, on the
HG002 300x window split in two — and it decides whether 600 is two deep seams'
worth, as the comment claims, or off by an order of magnitude in either
direction. Note what it does *not* decide: at that depth the reader's own lever
already exists and is the one they are using, `drawProperPairArcs: false`
dropping 9138 of 9204 arcs, so the cap is a floor under the frame rate rather
than a filter, and a wrong number here degrades a picture that is a wash of ink
either way.

Three companion counts were taken at the same time and have been re-read but
never re-run, so treat them the same way: that HG02768 view yields 0
cross-region arcs both as one region and as two regions 2 Mb apart — the 52 came
from splitting it 300 bp apart — and 865 of 9204 arcs are interchromosomal at
`1:2,000,000` on HG002 300x.
