---
name: fold-the-synteny-follow-s-reverse-strand-vote-into-followwindowsmapping
description: Fold the synteny follow's reverse-strand vote into `followWindowsMapping`'s block loop
area: comparative-and-pangenome
---

# Fold the synteny follow's reverse-strand vote into `followWindowsMapping`'s block loop

measured 2026-08-30 and declined. It reads as free: after
scoping the vote to the contig the row is placed on, `followReverseShare` scans
exactly the blocks the mapping already visits and accumulates the same
`overlap` the mapping already computes, so a `reverseOverlap` field on `Target`
would delete a whole pass. But the two run on **different clocks** — the
mapping is the frame pass (`followFrameSpan`, once per frame past the picked
block), the vote is settle-only — so folding moves work from the rare caller
into the hot one. A/B'd interleaved at 300k blocks over 24 windows, the two
extra lines cost **0.3% of the mapping loop (0.24ms of 70ms)** while the vote
costs **3.5ms per settle**: at 60 frames/s against ~2 settles/s that is
**+15ms/s spent to save 7ms/s**, a net loss of about 2x, and it would put a
settle-only concern inside the loop the module doc already names as the first
thing to measure if dragging a whole-genome overview reads as slow. The vote is
cheap precisely because it accumulates for ONE window where the mapping
accumulates for all of them. Reopen only if the vote ever has to run per frame.
