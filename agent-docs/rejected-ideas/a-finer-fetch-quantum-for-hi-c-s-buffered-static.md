---
name: a-finer-fetch-quantum-for-hi-c-s-buffered-static
description: A finer fetch quantum for hi-C's buffered static-block fetch
area: performance-and-measurement
---

# A finer fetch quantum for hi-C's buffered static-block fetch

measured
2026-08-22 and parked. Since the absolute-coordinates rewrite the display
fetches `staticBlocks.contentBlocks`, which at a 1588 px canvas is 1.51x the
visible span (the blocks are 800 CSS px on a grid), so a pan inside them is a
pure redraw. Contacts grow with span squared and every one of them is an
instanced quad whose vertices the rasterizer runs whether or not its fragments
land on screen — at a 50 Mb span on a deep map that is **609,913** contacts
against the visible span's **318,024** — so the buffer looked like it might
cost the frame. It does, on one rung, at one zoom.
**On WebGPU nothing measurable; on WebGL2 ~10 ms at the deepest zoom.** Rao
2014 HMEC combined (7.6 GB, hg19), 1588x300 canvas, panning a pixel per frame
inside the loaded blocks, five zooms from 500 kb to whole-chr1: the median
frame interval never leaves vsync (16.4-16.9 ms) on WebGPU / AMD RDNA-1 in
either arm at any zoom, while on WebGL2 / Intel UHD 630 the 50 Mb row goes
**17.3-17.9 ms visible-span to 27.0-27.4 ms buffered** over three runs of
each, which is 60 fps to ~37 while panning. Every other zoom holds vsync on
both rungs and both arms.
The whole-chromosome row is the control: there the static blocks ARE the
visible span, both arms draw the same 396,234 contacts, and they score the
same.
**Parked because the buffer is what bought pan-is-a-redraw**, and what it
replaced was a refetch on every pan — a network round trip and a spinner
against 10 ms of vertices. So the lever, if it is ever wanted, is a smaller
buffer and not a return to refetching: buffered visible spans snapped to a bin
grid, e.g. expand by a quarter span and snap to 64 bins, which at that zoom is
~1.25x rather than 1.51x and on the same measured slope gives back about half
of the 10 ms.
**What would change the answer:** pan jank reported on a deep map at an
arm-scale zoom on a machine where the ladder falls through to WebGL2 — a
browser without WebGPU, a blocklisted driver, or `?renderer=webgl` — which is
a rung the app ships and not a hypothetical one. Re-measure before building:
`products/jbrowse-web/browser-tests/probe-hic-buffered-vertex-cost.ts` carries
the whole table, the GPU each column was taken on, and the two-line switch the
visible-span arm needs.
**The lever also conflicts with a live idea** —
[ideas/fill-the-whole-display-rectangle-not-just-the-hi-c-triangle.md](../ideas/fill-the-whole-display-rectangle-not-just-the-hi-c-triangle.md)
wants the buffer *wider*, because the contacts
measured here as vertex cost are the ones that fill the triangle's empty
corners. Whichever is built kills the other; decide that before either.
