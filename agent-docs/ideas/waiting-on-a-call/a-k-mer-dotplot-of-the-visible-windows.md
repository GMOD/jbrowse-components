---
name: a-k-mer-dotplot-of-the-visible-windows
description: A base-level dotplot of the sequence on screen, self or across a synteny view's two sides, computed per pixel on the GPU. No PAF anticipates every pair of windows a user zooms to, so it is the best new picture in-browser compute offers.
---

# A k-mer dotplot of the visible windows

Each output pixel asks whether the k-mer at x matches the k-mer at y, over the
sequence on screen: one window against itself, or the two sides of a synteny
view against each other.

It passes both tests in
[CLUSTERING_WORKFLOW](../../reference/CLUSTERING_WORKFLOW.md) §"Which in-browser
compute is worth doing": the input is whatever 50 kb x 50 kb pair the user zooms
to, which no offline alignment anticipates, and the work is quadratic in a small
input whose output is an image the GPU already holds. A sequence fetch per
window is the only data it needs.

The call is where it lives: a mode of the dotplot view at base zoom, or a panel
of the linear synteny view, and what k and match rule (exact, or reverse
complement too) it defaults to.
