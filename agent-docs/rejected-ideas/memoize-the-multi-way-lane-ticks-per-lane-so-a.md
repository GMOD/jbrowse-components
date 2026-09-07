---
name: memoize-the-multi-way-lane-ticks-per-lane-so-a
description: Memoize the multi-way lane ticks per lane, so a change in one lane stops rebuilding every lane's ticks
area: performance-and-measurement
---

# Memoize the multi-way lane ticks per lane, so a change in one lane stops rebuilding every lane's ticks

measured and declined 2026-09-05, from the
synteny audit that also landed the display's other two perf items. The shape
is real: `tickGeometry` calls `buildTickGeometry({stack})` and walks the whole
stack, and `laneStack` is one object rebuilt whenever anything it reads
changes. The cost is not. `MAX_LANE_TICKS` already caps a lane at 24 tick
intervals — past that the ticks read as hatching rather than as a scale — so
the marker count is bounded at ~48 a lane by construction and cannot grow
with the data at all. `multiwayZoomCost.probe.ts` over nineteen zoom steps of
grape/peach/cacao, 7 lanes out to the whole chromosome, books ticks at
**0.03-0.11 ms** for the entire stack at every step, against 34 ms of glyph
cells and 4 ms of lane decision beside it. The first step's 0.4 ms is the cold
one.

A memo would also almost never hit. A tick's x comes from the lane's frame
through `rowFrameX`, and a pan moves every frame, so on the gesture that
rebuilds the stack most often the ticks genuinely changed. What is left is a
rebuild that leaves the frames alone — a gene fetch landing, a height change —
where the waste is re-uploading seven marker cells of under 48 instances each.
