---
name: give-the-coordinate-ruler-a-genuinely-fixed-tick-pool
description: the positional keys landed and cut the scalebar's structural churn 535 → 248; what is left is the label COUNT moving between frames, worth about that remainder — and worth weighing against a canvas ruler or coarsening off `coarseBpPerPx` before any of it is built
---

# Give the coordinate ruler a genuinely fixed tick pool

Moved out of [TODO.md](../TODO.md) on 2026-08-26, when the backlog was cut to
what v5.0.0 turns on. The half that was worth most landed, and the remainder
has two unchosen alternatives beside it.

The key half landed 2026-08-15: `ScalebarCoordinateLabels` keys its list
positionally, so a zoom repositions and relabels nodes instead of rebuilding
them, and the scalebar's structural churn over a 5× zoom went 535 → 248 against
a 1523 → 1369 total.

What is left is the label *count* moving between frames — positional keys pool
`min(oldCount, newCount)` and still mount or unmount the difference, and the
count shifts as label text changes width and `labelFitsInBlock` /
`MIN_TICK_LABELS_PER_BLOCK` drop a different number of them. A constant node
count with the extras hidden closes it, and is worth about that remainder.
Weigh it against the other two options before building:  a canvas ruler (bigger
win, loses selectable text), or coarsening ticks off `coarseBpPerPx` during the
zoom spring and snapping exact on settle.

[reference/INTERACTION_PERF.md](../reference/INTERACTION_PERF.md) has both
measurements and the repro tool, including the trap that it serves
`products/jbrowse-web/build` and so needs a rebuild between arms.
