---
name: a-clustering-tolerance-inside-arckey
description: A clustering tolerance inside `arcKey`
area: rendering-and-displays
---

# A clustering tolerance inside `arcKey`

measured 2026-08-14 and declined,
after being proposed twice: once so the arc band would agree with the sashimi
overlay's 10 bp window, once on the worry that a real fusion's support splits
across the aligner's microhomology jitter. On the hosted K562 Iso-Seq BAM (579
records over the figure's chr22 window) the split is **26/1/1/1** — one
dominant arc at the canonical e14a2 acceptor with three singletons within
20 bp, inside two screen pixels and under its own stroke. **What was given
up:** two reads of support, for a change to `arcKey`'s exact-coordinate rule,
which the whole coalescing story rests on. A split read knows its breakpoint to
the base; what it doesn't know is which base the aligner picked inside the
microhomology, and that ambiguity is smaller than the ink. Mate pairs are the
opposite case and already handled: they straddle a breakpoint rather than
landing on it, so `clusteredInterchromSupport` counts over a window — a support
FLOOR, not a merge, and it never invents a position. Numbers in
[DEMO_DATASETS.md](../reference/DEMO_DATASETS.md).
