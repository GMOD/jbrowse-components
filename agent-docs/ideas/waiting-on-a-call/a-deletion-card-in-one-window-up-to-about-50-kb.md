---
name: a-deletion-card-in-one-window-up-to-about-50-kb
description: jb2export draws any deletion over about 1 kb as two windows, repeating the gap's length label in each; one window reads better at a 12 kb deletion. Where the cutoff sits, near 50 kb, is the call, and one window needs an in-window split count.
---

# A deletion card in one window up to about 50 kb

jb2export batch draws any deletion over about 1 kb as two windows cut between
its ends (`recordWindows`,
`products/jbrowse-img/src/batch.ts`). A long read's gap across the cut then
draws in both, each repeating the gap's length label. At COLO829's 12 kb PTEN
deletion (chr10:87,940,542-87,952,583, card 366 of the COLO829 review portal)
one window reads better: the coverage dip, the gap-deletion arc
([ADR-288](../../architecture-decision-records/adr-288-the-junctions-band-counts-a-deletion-the-reads-carry-as-a-gap.md))
and the split reads' dome would sit in one frame.

## The call

Up to what size does a same-reference deletion take one window? About 50 kb
was named when this was raised, and nothing has measured where two windows
start to read better.

## What it needs

`links` (`renderRegion.ts`) counts only reads joining one window to another,
so a one-window card reports no split count. It needs an in-window split count,
the split reads whose two pieces both land in the one window.

[a-joined-card-on-one-reference-draws-its-split-join-twice](../ready/a-joined-card-on-one-reference-draws-its-split-join-twice.md)
is the doubled dome on the two-window cards this would leave above the cutoff.
