---
name: a-quantitative-splice-junction-track-of-its-own
description: sashimi exists only as an overlay on the pileup, so junction counts cannot be read, sorted or exported as a track of their own — but a new track type is a design nobody has started, and the overlay's own future is part of it
---

# A quantitative splice-junction track of its own

Moved out of [TODO.md](../TODO.md) on 2026-08-26. It sat under "small and
self-contained", which a new track type is not: nothing past "somewhere to live"
is designed — no adapter, no display, no decision about whether the overlay
stays beside it or becomes it.

Sashimi is an overlay (`plugins/alignments/src/features/sashimi`) and nothing
else. There is no junction track type — confirmed 2026-08-26, no
`SpliceJunction`/`JunctionTrack` anywhere in `plugins` or `packages` — so
junction counts can only be read where a pileup is already drawn, at whatever
height that pileup wants.

The classification work landed underneath it (`6199ddb914` tags each junction's
splice motif off the reference and hides the non-canonical ones), so what a
standalone track would draw is already computed; what it lacks is somewhere to
live.

Related: the tutorial section on loading junction files as BED arcs has no
figure — [capture-a-figure-for-the-junction-bed-tutorial-section](capture-a-figure-for-the-junction-bed-tutorial-section.md).
