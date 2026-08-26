---
name: say-how-many-features-are-under-the-cursor-in-a-collapsed-pileup
description: the count is already in hand at hit time — the flatbush search returns every match before `topmostMatch` picks one, so a tooltip line is probably the whole job
---

# Say how many features are under the cursor in a collapsed pileup

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. A tooltip line, probably an afternoon, and nobody is
waiting on it.

The density collapse pins sub-pixel marks to row 0, where several share a pixel
column. `performMultiRegionHitDetection` resolves the topmost, so the rest can
be *seen* — they fade, and the column's opacity tracks how many there are
(`pileupFadeIds`) — but never inspected.

**Nothing has to be recomputed.** The flatbush search returns every match before
`topmostMatch` picks one, so the count is in hand at hit time and a tooltip line
("+3 more here") is probably the whole job. Confirmed 2026-08-26 that no such
affordance exists yet.

A click-to-list is the larger version and a separate decision.
