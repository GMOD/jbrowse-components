---
name: unified-gpu-canvas2d-layer-manifest-draw-dispatch
description: Unified GPU/Canvas2D "layer manifest" draw dispatch
area: rendering-and-displays
---

# Unified GPU/Canvas2D "layer manifest" draw dispatch

declined 2026-06,
then **overturned band by band**, and the shape of the mistake is worth having.
The decline read: layers aren't 1:1 across backends — `PASS_CLIP` is one GPU
pass but two Canvas2D calls, coverage is individual passes vs one
`drawCoverage` wrapper, mismatch is one gate over three passes — so uniform
rows need shims that add back what the table removes.

Every clause is true and none of them was the question. A manifest is **two**
maps over one list of ids, not one table of uniform rows: a shared list holding
the z-order and the gates, and a `Record<LayerId, …>` per backend free to
resolve an id to whatever that backend needs. `PILEUP_LAYERS` landed on exactly
that afterwards and the "disqualifying" clip shim is two lines inside one
record entry. `COVERAGE_LAYERS` followed in 2026-08: the `drawCoverage`
wrapper turned out to hold five calls mapping 1:1 to the five passes, under
gates that already agreed — so what the entry described as a structural
mismatch was two statements of one list, which is what a registry is for. In
2026-09 the list and its two records collapsed further, into
`coverageBandMarks` in alignments-core: each layer is a shape carrying its
pass and its painter, and MAF and alignments declare the same five.

**The lesson is about what "not 1:1" licenses.** It argues against collapsing
the CALLS; it says nothing about sharing the LIST, and the list is where drift
costs correctness — a coverage pass added to the GPU registry compiled clean
and silently vanished from Canvas2D and the SVG export for as long as this
entry stood. Read a "not uniform" claim as naming the layer it is true at.
[draw-pass-registries](../mechanisms/draw-pass-registries.md) carries the
precondition that settles the next case without re-arguing this one.

**What survives:** the asymmetry inside the coverage band is real and was not
erased. Four layers scale to the depth domain and one does not, and forcing
the fifth to take a scale it ignores would have blanked the indicator
triangles for the half-second the autoscale is debounced. The record's entries
differ; the list they are keyed on does not. Arcs stay unshared for a
different and still-good reason: the band is four GPU passes against one
`drawArcs`, and the split is a GPU buffer-per-shape artifact rather than a
layer list — the Canvas2D path already mirrors `ARC_PASSES`' order and
`flatPaintOrder.test.ts` pins it.
