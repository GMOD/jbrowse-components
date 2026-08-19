---
name: cross-region-arcs-view-space-pass
description: If the cross-region arc set ever outgrows its SVG overlay, one extra GPU pass reusing arc.slang unmodified draws it — packed against layout pixels rather than bp, scissored to the band over the whole canvas. What makes the substitution legal, and the two costs it carries.
---

# Draw the cross-region arcs as a view-space GPU pass

Designed, not built, and deliberately so: the escape hatch for the day
`CrossRegionArcsOverlay`'s set gets big enough that SVG elements are the wrong
container for it. `CROSS_REGION_ARC_CAP` is a floor under the frame rate until
then, and the reader's own lever at that depth (`drawProperPairArcs: false`,
which drops 9138 of 9204 arcs on HG002 300x) is the real answer.

**One extra pass, reusing `arc.slang` unmodified.** Pack the cross-region arcs
against layout pixels instead of bp, then set `blockStartPx` / `blockWidth` /
`bpLo` / `bpLen` so that the shader's "bp" axis *is* layout px, and set `canvasW`
to the **view's** width so `arcIsFar` is asked once for the whole mark rather
than once per block. Scissor to the band over the full canvas instead of per
block.

**What makes the axis substitution legal.** Displayed regions lay out
contiguously: `calculateDynamicBlocks.ts` advances by `regionWidthPx` with no
inter-region padding, except the two boundary blocks. Layout px and bp are
therefore the same axis under an affine map, which is also why the SVG overlay
lines up with the canvas exactly today — the same fact the current
implementation already rests on.

**What it costs.** A repack on zoom, a second uniform-fill path, and the split of
"drawn coordinate" from "reported coordinate" that the tooltip needs. That last
one is not new: `arcYBp` / `arcSpanBp` is the scar already recording the same
split one axis over, so the shape is known rather than speculative.
