---
name: a-view-space-gpu-pass-for-the-cross-region-arcs
description: A view-space GPU pass for the cross-region arcs
area: rendering-and-displays
---

# A view-space GPU pass for the cross-region arcs

designed in full as
`ideas/cross-region-arcs-view-space-pass.md`, then closed as a contingency
nobody is going to reach. The idea is sound: pack the cross-region arcs against
layout pixels instead of bp, set `blockStartPx`/`blockWidth`/`bpLo`/`bpLen` so
the shader's "bp" axis *is* layout px and `canvasW` is the view's width (so
`arcIsFar` is asked once per mark rather than once per block), scissor to the
band over the whole canvas, and `arc.slang` runs unmodified. The axis
substitution is legal because displayed regions lay out contiguously —
`calculateDynamicBlocks.ts` advances by `regionWidthPx` with no inter-region
padding except at the two boundary blocks — which is the same fact that makes
the SVG overlay line up with the canvas today.

What kills it is that the problem it solves is already answered twice over:
`CROSS_REGION_ARC_CAP` is a floor under the frame rate, and the reader's own
lever at real depth is better than anything the renderer can do —
`drawProperPairArcs: false` drops 9138 of 9204 arcs on HG002 300x. Against
that, the pass costs a repack on zoom, a second uniform-fill path, and a split
of "drawn coordinate" from "reported coordinate" for the tooltip. Revisit only
if a real set outgrows the SVG overlay with the cap already lifted.
