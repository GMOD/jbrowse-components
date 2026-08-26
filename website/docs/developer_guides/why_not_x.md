---
title: Why not deck.gl, Pixi, Rust or wgpu
description:
  The rendering engines and languages evaluated instead of our own backend, why
  the ladder targets WebGPU over WebGL2 alone, what we took from GenomeSpy, and
  where Rust earns its place
guide_category: Advanced topics
---

**TL;DR:** JBrowse gives every track its own canvas, and on WebGL2 each canvas
holds its own driver context — a browser hands out sixteen per page, so one view
with seventeen GPU tracks exhausts them. WebGPU serves every canvas on a page
from one device, which is why the ladder targets it first, then WebGL2, then
Canvas2D. Three constraints follow from how a track gets its data, and every
rendering library below fails at least one of them. Rust runs here in
decompression, offline preprocessing and build tooling, because none of the
three clocks a track's cost splits into is waiting on a faster language.

Three constraints decide what this renderer can be built on:

- **A display's drawing has to survive [](/docs/developer_guides/svg_export).**
  A display that draws to a canvas ships a Canvas2D draw function, and the
  export runs that function rather than the shader, so on-screen and exported
  pixels cannot drift. A display light enough to skip the canvas emits SVG
  directly instead — the arc displays and `MultiWaySyntenyDisplay` render the
  same JSX `<path>` elements on screen and into the export. Either way the
  display already owns a drawing path the GPU has no part in, and a rendering
  library would add one more implementation of every glyph to keep in step with
  it.
- **The bytes are never converted.** A worker decodes a track into
  [one typed array per attribute](/docs/developer_guides/optimizations#the-worker-boundary),
  which crosses `postMessage` as a transferable and uploads to the GPU without
  the main thread reading it. A retained-mode scene graph undoes that, because
  it wants a JavaScript object per feature and mutates it per frame.
- **Coordinates are absolute `uint32`.** A worker emits positions along a whole
  assembly, which run to hundreds of megabases, and float32 stops representing
  integers exactly above about 16 Mbp — so the shader
  [splits each coordinate into a high and a low half](/docs/developer_guides/optimizations#coordinates-are-absolute-uint32-split-in-the-shader)
  and does the arithmetic on the pair. An engine that takes float32 positions
  cannot draw a chromosome-scale view without visible jitter.

## The rendering libraries

| candidate                 | what it is                                  | why not here                                                     |
| ------------------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| deck.gl (over luma.gl)    | layer framework for geospatial overlays     | a shader per backend anyway, and no Canvas2D path                |
| Pixi                      | 2D scene graph, WebGL and WebGPU            | composable shader bits pay off under remixing; ours are fixed    |
| Three.js (and TSL)        | 3D scene graph, node-graph shading language | dual output works, but a node graph replaces shaders we can read |
| regl                      | thin functional WebGL wrapper               | WebGL only, so it cannot carry the WebGPU path                   |
| wgpu to wasm              | Rust GPU abstraction                        | megabytes per page load, over a WebGL fallback we would debug    |
| Babylon.js runtime Tint   | transpiles shaders in the browser           | compiler bytes to every reader, cross-compile failures in prod   |
| WebGPU Compatibility Mode | one API over older GPU feature levels       | needs a secure context we cannot require                         |

deck.gl comes closest, because it takes binary attributes without building an
object per feature, but it has no Canvas2D backend, so SVG export would need a
second implementation of every glyph.
[ADR-005](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md)
records the evaluation and what it chose instead: shaders authored once in
Slang, cross-compiled to WGSL and GLSL ES at build time.

[GenomeSpy](https://genomespy.app/) hit the coordinate wall first and solved it
with the same high/low split, so we took the technique rather than
reimplementing it — `packages/render-core/src/shaders/hpmath.slang` carries the
MIT attribution and `hpSplitUint` is the function. What we left is the grammar:
JBrowse composes tracks a plugin registered, not a visualization someone
authored.

## Why WebGPU, and not WebGL2 alone

Each display owns one canvas, and `WebGL2Hal` takes its own `webgl2` context for
it with no pooling between them, so on WebGL2 the number of live contexts on a
page is simply the number of open GPU tracks. A browser allows sixteen, which
one ordinary linear view reaches at seventeen tracks. Past that the browser
makes room by evicting a live context, the display that lost it re-acquires,
that acquisition evicts another, and the cascade wedges the main thread. WebGPU
removes the per-canvas cost entirely, because
`packages/render-core/src/gpuDevice.ts` holds one `GPUDevice` for the whole page
that every canvas configures against, so an added track costs a swap chain.
[GPU_CONTEXT_BUDGET.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_CONTEXT_BUDGET.md)
owns the measurement and the fixes it eliminated.

Three smaller differences also reach the code. WGSL reads instance data from a
storage buffer, which GLSL ES 3.00 has none of, leaving vertex attributes or a
uniform block capped near 64 KB that a real render passes at a few thousand
instances — that split is why the shader source is cross-compiled rather than
shared at runtime. WebGPU renders 4x MSAA through a resolve texture, and WebGL2
has no equivalent here. And the WebGPU backend reads `device.limits` at runtime,
where WebGL2 can ask for neither limit this tree needs and so hardcodes them.

One `GPUDevice` serves every display on the page, so a `device.lost` takes all
of them down together and the device limits are one budget the whole page draws
against. That places a bug report quickly: _one track broke_ is a WebGL2
symptom, _every track broke at once_ is a WebGPU one.

## Why not Rust in the browser

A track's cost splits into
[three clocks](/docs/developer_guides/optimizations#three-clocks), and rewriting
a hot loop in Rust would have to move one of them:

- **The fetch clock is already compiled.** Decompression is 70-90% of a cold
  query and runs through libdeflate in wasm, at parity with native `zlib`. What
  remains is building records out of the decompressed bytes, and a byte-level
  scan measured slower there than the string chain it would replace, because
  V8's sliced strings cost almost nothing to make.
- **The frame clock is spent in React.** Frame time tracks the CPU throttle
  while the RPC workers profile idle, and what runs in it is
  [re-render](/docs/developer_guides/optimizations#interaction-cost-is-react-re-render)
  and CSS-in-JS, which a faster language for the loops does not touch.
- **The load clock gets worse.** A wasm module is bytes that every host has to
  evaluate before a plugin can register, and shrinking that budget already took
  [six pins](/docs/developer_guides/optimizations#the-load-clock).

Hand-tuning a loop within TypeScript has the same trouble: two rewrites of a MAF
worker loop
[measured worse than the plain loop they replaced](/docs/developer_guides/optimizations#two-kernels-that-look-like-wins-and-are-not),
because the shape of the memory access is what moves the number, and that is
already visible in TypeScript.

## Where Rust earns it

Rust runs in three places here, sharing one property: each either runs before
the browser does, or is small enough that its bytes do not show up on the load
clock.

- **The decompression kernel.** `@gmod/bgzf-filehandle` and `@gmod/bbi` inflate
  through `libdeflater` compiled to wasm — the measured majority of a cold
  query, in tens of kilobytes rather than megabytes.
- **Offline preprocessors.** `maf2bed`, a Rust CLI on crates.io, writes the
  coarse summary tier a whole-chromosome MAF view reads, which moves the work
  out of the browser altogether.
- **Build tooling.** CI validates every generated WGSL shader with `naga`, the
  wgpu project's own compiler, installed with `cargo install`. It costs a CI
  cache entry, and a reader never loads it.

## How the decision gets made

Identify which clock a change lands on, measure it against the code it would
replace, and publish the number even when it comes out a loss.
[](/docs/developer_guides/optimizations) carries those beside the wins, and
[REJECTED_IDEAS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REJECTED_IDEAS.md)
is the longer list. If a library now clears the three constraints at the top,
that is a measurement worth taking —
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md)
is how to take one that holds up.
