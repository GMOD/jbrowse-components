# From block-based rendering to WebGPU + WebGL

## A short history of block-based rendering

Since JBrowse 1, "block-based" rendering has been core to how JBrowse thinks
about a genome view. JBrowse 2 pushed it further: every block became a
web-worker request that produced a PNG, which the main thread stitched into the
visible window.

It wasn't a great fit. Several track types aren't naturally block-based, so the
abstraction had to be worked around repeatedly. A typical alignments track took
shape like this:

1. Estimate the Y scalebar for coverage across the whole view.
2. Render each coverage block (≈3 blocks on a 1920 px screen tiled at 800 px).
3. Render each pileup block (another ≈3).

One track rendered its coverage three times and its pileup three times. The
architecture's single real win was that static tiles didn't redraw on every
frame, which kept side-scrolling smooth. But it critically couldn't zoom
smoothly — we papered over the seams with a CSS transform while the blocks
refetched and redrew, and a loading bar blanked the track on every zoom.

Ten thousand engineering-hours went into making this feel acceptable: caching,
prefetching, perceptual tweaks. The ceiling was still low.

## Moving to GPU rendering

In early 2026 we took on a full refactor aimed at truly smooth zooming. The
first iteration used WebGL and rewrote the alignments track. It worked, but
WebGL has a hard limit on the number of canvases you can open per page. We
switched to WebGPU, which renders to many canvases from a single
[`GPUDevice`](https://developer.mozilla.org/en-US/docs/Web/API/GPUDevice).

WebGPU has two real-world gaps: it requires a secure context, and is available
in roughly 70 % of browsers. Neither is hypothetical — Ian's browser couldn't
use even WebGL during a live demo, and at least one browser on my own machine
has the same issue.

## Three-tier backend fallback

To survive these gaps in production, each GPU display picks the best backend it
can at load time:

1. **WebGPU** if available.
2. **WebGL2** fallback if WebGPU isn't.
3. **HTML5 Canvas 2D** if WebGL2 isn't.

All three implement the same `Backend` interface. The HAL (Hardware Abstraction
Layer) in `packages/core/src/gpu/hal/` hides the WebGPU / WebGL2 difference;
Canvas 2D is a separate implementation of the same public surface. A
`?renderer=` URL override lets us force any backend, which is how the demo
environments and tests exercise them.

This costs development time — every new feature needs to work in three render
paths — but in exchange every user gets the best experience their browser
supports, with no blank states.

## Slang + TypeScript codegen

Maintaining two shader languages (WGSL for WebGPU, GLSL ES 3.00 for WebGL2) in
lockstep was the next hazard. Any drift silently broke one backend. We adopted
[Slang](https://shader-slang.com/) as the authoring language and built
`scripts/build-shaders.ts`, which compiles each `.slang` file to both WGSL and
GLSL and emits a `*.generated.ts` module with:

- Source strings for both backends.
- Uniform and per-instance offset tables shared with the main thread.
- A `slangPass()` helper that builds the `PassDescriptor` a backend needs to
  register the pass.

The upshot: one shader source of truth, no hand-maintained offset tables, and
the two GPU backends can't drift. ADR-005 covers the authoring conventions.

## Where this leaves us

- Smooth zoom and pan for alignments, variants, wiggle, dot-plot, synteny, HiC,
  and circular-view chord rendering.
- A uniform `installGpuDisplay(backend, { upload, render })` pattern every GPU
  display follows; two autoruns spawned by a mixin own all reactivity.
- A single shader language authored once, compiled twice, consumed by both GPU
  paths.
- A working Canvas 2D path for users whose browsers can't do WebGL at all.

The block-based era shipped the same visual per frame at the cost of constant
loading states. The GPU era ships the same _data_ once and redraws it for free
at 60 fps.
