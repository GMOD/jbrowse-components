---
name: porting-the-canvas-display-s-scrollextentmaxy-narrowing-to-the-pileup
description: Porting the canvas display's `scrollExtentMaxY` narrowing to the pileup
area: rendering-and-displays
---

# Porting the canvas display's `scrollExtentMaxY` narrowing to the pileup

—
measured 2026-08-16 and declined. `e122978eaf` narrowed the canvas feature
display's scroll extent to the deepest row an **on-screen** feature occupies,
because the fetch buffers half a screen either side and the pack places every
buffered feature, so the scrollbar and the edge shadow offered a scroll onto
blank canvas. The pileup looks like the same case on paper and is not: it lays
out over `loadedRegions` too (`groupLayoutContext`), and its `heightMode`
defaults to `fixed`, which scrolls — so the mechanism is present on the default
configuration. It just costs nothing.
`browser-tests/probe-pileup-scroll-extent.ts` compares the deepest row reached
by a read intersecting the visible span against the group's laid-out `maxY`
over five volvox loci, including a window at the covered region's edge:
**wasted extent is 0 px in every case**, with 47-63% of the laid-out reads
off-screen (`210/393`, `229/440`, `330/525`).
**Why the analogy breaks:** the canvas case is *sparse* — 8 genes can pack 20
rows deep, and one off-screen gene owns a whole row nothing on screen uses. A
pileup row is shared by many reads, so an off-screen read almost always lands
in a row an on-screen read occupies too, and the two maxima coincide. **What it
would have cost:** a per-read scan of `readYs`/`readPositions` per pan settle,
in the display where that walk is largest, plus a design call the canvas
display never faced — in grouped mode the blank at an interior section's bottom
is real layout you must scroll through to reach the sections below, so only the
*last* section's trailing blank is wasted, and narrowing per-group `maxY` would
move every band position. Reopen only with a dataset where the probe prints a
non-zero column.
