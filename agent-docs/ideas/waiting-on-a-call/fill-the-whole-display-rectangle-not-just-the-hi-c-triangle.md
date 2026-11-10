---
name: fill-the-whole-display-rectangle-not-just-the-hi-c-triangle
description: Filling the Hi-C display's empty bottom corners needs contacts whose far end is off screen, a fetch margin of up to half a span past each edge, which costs panning and rules out the parked smaller fetch quantum; the call is whether the corners are worth that.
---

# Fill the whole display rectangle, not just the hi-C triangle

Moved out of [TODO.md](../../TODO.md) on 2026-08-26. Not a defect and not a
decided direction: it changes the display's fetch shape and forecloses a parked
idea pointing the other way. That is a product call about what the hi-C display
IS, so it belongs with the proposals.

The display draws the rotated triangle — canvas x is a pair's midpoint, y its
separation. Under the default `heightMode: 'fixed'` the triangle keeps square
cells and stands half the view's width tall, and a track shorter than that cuts
it: `drawHicBlocks` culls the bins below the canvas (`665f5faa40`) and the GPU
rasterizer clips them. So y already means a fixed bp separation per px at the
current zoom, a diagonal band, and `'fit'` (`TriangleMatrixMixin`) is the opt-in
that squashes the whole triangle into the display height.

Either way the two bottom corners are the part of the box the triangle's edges
never reach. What a corner wants is contacts whose far end is off screen: the
point `(x, y)` draws the pair `(x - y, x + y)`, so the corner at depth y asks
for data y past the edge. Under `'fixed'` that margin is the track's height in
bp separation; under `'fit'`, or a track as tall as the apex, it is half a
visible span past each edge, a fetch window of 2x the visible span.

**The price is vertex cost while panning.** A finer fetch quantum was declined
on the same population: 609,913 contacts against the visible span's 318,024 at
a 50 Mb span on a deep map, which is vsync on WebGPU and 27 ms (60 fps to ~37
while panning) on the WebGL2 rung. That makes the parked lever (a *smaller*
fetch quantum) the opposite direction: emptying the corners is the one thing
the fill cannot afford, so whichever is built kills the other.

**The call is whether the corners are worth the margin**, and whether only
`'fixed'`, where the margin is bounded by the track height, gets it.
`hicTransform`'s inverse is what keeps the hit test honest at the corners, so
either way wants a case in `hicTransform.test.ts`.
