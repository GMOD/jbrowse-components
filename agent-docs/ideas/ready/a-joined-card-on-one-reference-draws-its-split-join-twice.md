---
name: a-joined-card-on-one-reference-draws-its-split-join-twice
description: A two-window jb2export card on one reference draws a split join twice, as the junctions dome and as the read-connections arc a joined image turns on; turn that band on only for cross-reference cards, after checking `links`, which reads it.
---

# A joined card on one reference draws its split join twice

A two-window jb2export card whose windows lie on one reference draws each split
join twice: once as the junctions band's dome over the coverage, and once as
the read-connections arc that jb2export turns on for every joined image
(`applyDisplayOpts`, `products/jbrowse-img/src/applyTrackOpts.ts`, which sets
`readConnections.show` when `joined` and the track states nothing).

## The fix

Turn the read-connections band on only for a joined card whose windows are on
two references, where the junctions band has no dome to draw. On one reference
the junctions dome already joins the two windows.

Check `links` first (`renderRegion.ts`, reported per card by `runBatch.ts`): it
counts the reads joining the windows off the read-connections band, so a
same-reference card with that band off must still report its split count,
either by keeping the band on and hiding its marks or by counting off the
junctions band's split junctions.

## Related

[a-deletion-card-in-one-window-up-to-about-50-kb](../waiting-on-a-call/a-deletion-card-in-one-window-up-to-about-50-kb.md)
would draw a deletion under its cutoff in one window, which removes this
doubling for those cards and leaves it for the larger ones.
