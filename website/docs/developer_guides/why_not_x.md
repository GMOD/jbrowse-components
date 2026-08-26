---
title: Why not deck.gl, Pixi, Rust or wgpu
description:
  The rendering engines and languages evaluated instead of our own backend, why
  the ladder targets WebGPU over WebGL2 alone, what we took from GenomeSpy, and
  where Rust earns its place
guide_category: Advanced topics
---

**TL;DR:** Every engine below was evaluated against the same three constraints,
and none of them clears all three. WebGPU sits above WebGL2 on the ladder
because a page gets sixteen WebGL2 contexts and one linear view can spend them
all. Rust is in three places, all of them before the page loads.

Three constraints decide what this renderer can be built on:

- **Canvas2D is the floor, not a fallback.** Every canvas-drawing display ships
  a Canvas2D draw function, and [](/docs/developer_guides/svg_export) calls that
  function rather than the shader, so exported and on-screen pixels cannot
  drift.
- **The bytes are never converted.** A worker decodes a track into
  [one typed array per attribute](/docs/developer_guides/optimizations#the-worker-boundary)
  that uploads to the GPU unread, so a retained-mode scene graph — an object per
  feature, mutated per frame — is off the table.
- **Coordinates are absolute `uint32`.** float32 loses exactness above about 16
  Mbp, so the shader
  [splits each coordinate into a high and a low half](/docs/developer_guides/optimizations#coordinates-are-absolute-uint32-split-in-the-shader).

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

deck.gl comes closest — it takes binary attributes without building objects —
and still leaves SVG export needing a second implementation of every glyph.
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

A page gets sixteen WebGL2 contexts, one display owns one, and one ordinary
linear view reaches the ceiling at seventeen GPU tracks — past it the browser
evicts a context, the display re-acquires, and the cascade wedges the main
thread. `packages/render-core/src/gpuDevice.ts` holds one page-wide `GPUDevice`
instead, so a track costs a swap chain rather than a driver context.
[GPU_CONTEXT_BUDGET.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_CONTEXT_BUDGET.md)
owns the measurement and the fixes it eliminated. WebGPU also brings storage
buffers, which GLSL ES 3.00 lacks, along with 4x MSAA and runtime
`device.limits`.

One shared device trades the other way, which is useful for triage: _one track
broke_ points at WebGL2, _every track broke at once_ points at WebGPU.

## Why not Rust in the browser

Rust lands on one of the
[three clocks](/docs/developer_guides/optimizations#three-clocks) a track's cost
splits into, and none of them waits on a faster language. Decompression is
already compiled; what is left of the fetch clock is record building, where a
byte-level scan measured slower than V8's sliced strings. The frame clock is
[React re-render](/docs/developer_guides/optimizations#interaction-cost-is-react-re-render),
not compute. The load clock gets worse, since every host evaluates a wasm module
before a plugin can register. And hand-tuned kernels are not free either — two
rewrites of a MAF worker loop
[measured worse than the plain loop](/docs/developer_guides/optimizations#two-kernels-that-look-like-wins-and-are-not).

## Where Rust earns it

Three places, all of them small enough that their bytes disappear or early
enough that the page never sees them:

- **The decompression kernel.** `@gmod/bgzf-filehandle` and `@gmod/bbi` inflate
  through `libdeflater` compiled to wasm — the measured majority of a cold
  query, in tens of kilobytes rather than megabytes.
- **Offline preprocessors.** `maf2bed` writes the coarse summary tier a
  whole-chromosome MAF view reads, moving the work out of the browser instead of
  making the browser faster at it.
- **Build tooling.** CI validates every generated WGSL shader with `naga`, which
  costs a cache entry rather than a page load.

## How the decision gets made

Identify which clock a change lands on, measure it against the code it would
replace, and keep the result when it is a loss.
[](/docs/developer_guides/optimizations) publishes those beside the wins, and
[REJECTED_IDEAS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REJECTED_IDEAS.md)
is the longer list. If a library now clears the three constraints at the top,
that is a measurement worth taking —
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md)
is how to take one that holds up.
