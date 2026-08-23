---
name: fill-the-whole-display-rectangle-not-just-the-hi-c-triangle
description: decide what the y axis means once the apex stops bounding it; the cost is measured
metadata:
  area: hic, GPU
  category: visual-call
---

# Fill the whole display rectangle, not just the hi-C triangle

The display draws the rotated triangle — canvas x is a pair's midpoint, y its
separation — so the two bottom corners are the part of the box its edges never
reach, and `yScalar` (`squashToHeight`) stretches the triangle to the display
height rather than filling that box. What a corner wants is contacts whose far end is off screen:
the point `(x, y)` draws the pair `(x - y, x + y)`, so the deepest corner — left
edge, apex height — asks for data **half a visible span past the edge**, i.e. a
fetch window of 2x the visible span against today's static blocks at ~1.5x.

**Half of it is already happening.** Nothing culls on y —
`Canvas2DHicRenderer`'s cull is the x axis alone ("height is deliberately not
culled: the triangle apex and `yScalar` already bound it"), and the GPU path
lets the rasterizer discard — so every fetched contact landing in the rectangle
is drawn, and the buffered fetch already puts some of the corner population
there. Those are the same contacts measured as vertex cost in
[reference/REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md) §"A finer fetch
quantum for hi-C's buffered static-block fetch": 609,913 against the visible
span's 318,024 at a 50 Mb span on a deep map, which is vsync on WebGPU and
27 ms — 60 fps to ~37 while panning — on the WebGL2 rung. That is the closest
thing to a price tag this idea has, and it makes that entry's parked lever (a
*smaller* fetch quantum) the opposite direction: emptying the corners is the one
thing the fill cannot afford, so whichever is built kills the other.

**The call is what y means once the apex stops bounding it.** Fit-to-height ties
the apex to the visible span, so under a fill whole-chr1 asks for contacts
125 Mb apart — separations the file barely holds, at a binsize where the corners
come back empty anyway. The alternative is a max-separation knob, the shape a
horizontal hi-C track usually has: height means a fixed bp distance, the fetched
matrix is a diagonal band rather than a square, and the drawn count is bounded
by width x that distance instead of by span squared. Decide that before any of
it, because it decides the fetch shape.

Two things move with whichever way it goes: that y cull has to become real, and
`hicTransform`'s inverse is what keeps the hit test honest at the corners, so
both directions want a case in `hicTransform.test.ts`.


Every entry here opens with a measurement because the obvious build would be
guessing. The instrumentation pattern for the render-path ones is
[reference/PERF_INSTRUMENTATION.md](../reference/PERF_INSTRUMENTATION.md).
