---
title: Why not deck.gl, Pixi, Rust or wgpu
description:
  The rendering engines and languages evaluated instead of our own backend, why
  the ladder targets WebGPU over WebGL2 alone, what we took from GenomeSpy, and
  where Rust earns its place
guide_category: Advanced topics
---

**TL;DR:** Three constraints decided this renderer — a Canvas2D floor that SVG
export shares, typed arrays never converted between the worker and the GPU, and
genomic coordinates too large for float32 — and every engine below was evaluated
against them. WebGPU sits above WebGL2 on the ladder because a page gets sixteen
WebGL2 contexts and one linear view can spend them all. Rust is in three places,
all of them before the page loads.

## The three constraints

**Canvas2D is the floor, not a fallback.** Every canvas-drawing display ships a
Canvas2D draw function, and [](/docs/developer_guides/svg_export)
calls that function rather than the shader, so exported and on-screen pixels
cannot drift. A GPU library is a third path to keep in parity with those two.
Canvas2D is also what runs with no usable GPU, where it is the faster path.

**The bytes are never converted.** A track's data is decoded in an RPC worker
into
[one typed array per attribute](/docs/developer_guides/optimizations#the-worker-boundary),
crosses `postMessage` as a transferable, and uploads without being read. That is
[the largest single win](/docs/developer_guides/optimizations) here, and a
retained-mode scene graph — an object per feature, mutated per frame — breaks
it.

**Coordinates are absolute `uint32`, split in the shader.** float32 cannot hold
a position above about 16 Mbp exactly, so the shader
[cuts each coordinate into a high and a low half](/docs/developer_guides/optimizations#coordinates-are-absolute-uint32-split-in-the-shader).
Without that emulation, chromosome-scale positions come out wrong in a way that
reads as jitter.

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

[ADR-005](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md)
records that evaluation and what it chose: shaders authored once in Slang,
cross-compiled to WGSL and GLSL ES at build time. It also records a hand-rolled
mini-compiler that shipped malformed syntax and was abandoned.

**deck.gl** is the closest fit — it takes binary attributes without building
objects. It leaves the other two constraints: luma.gl's portable API still means
a shader per backend, because WebGL2 has no storage buffers, and with no
Canvas2D backend SVG export needs a second implementation of every glyph.

**Pixi** is what HiGlass renders through. Composable shader fragments earn their
indirection when a renderer remixes dozens of features into new programs;
JBrowse has a handful of fixed programs that are never remixed. Its display list
is also the retained-mode shape the worker's typed arrays skip.

**[GenomeSpy](https://genomespy.app/) hit the same wall first, and its answer is
in our shaders.** It is a WebGL2 toolkit for genomic visualization built around
a declarative grammar, and it solved the float32 coordinate problem with the
same high/low split. We took the technique rather than reimplementing it:
`packages/render-core/src/shaders/hpmath.slang` carries the MIT attribution and
`hpSplitUint` is the function. What we left is the grammar — JBrowse composes
tracks a plugin registered, not a visualization someone authored.

## Why WebGPU, and not WebGL2 alone

**A page gets sixteen WebGL2 contexts.** One display owns one canvas and one
context with no pooling, so contexts are open GPU tracks. Past the ceiling the
browser evicts a context, the display re-acquires, that evicts another, and the
cascade wedges the main thread instead of degrading. **One ordinary linear view
reaches it** at seventeen GPU tracks. Lazy mounting bounds the common case and
bounds nothing in a multi-panel workspace, where every panel is on screen.

`packages/render-core/src/gpuDevice.ts` holds one page-wide `GPUDevice` that
every canvas configures against, so on WebGPU a track costs a swap chain rather
than a driver context.
[GPU_CONTEXT_BUDGET.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_CONTEXT_BUDGET.md)
owns the measurement and the four alternative fixes it eliminated.

Three more differences reach the code above:

- **No instance-size cliff.** WGSL reads instance data from a storage buffer;
  GLSL ES 3.00 has none, leaving vertex attributes or a uniform block capped
  near 64 KB that a real render passes at a few thousand instances. That split
  is why the shader source is cross-compiled rather than shared at runtime.
- **Antialiasing.** WebGPU renders 4x MSAA through a resolve texture; WebGL2 has
  no equivalent here.
- **Queryable limits.** The WebGPU HAL reads `device.limits` at runtime. WebGL2
  can ask for neither limit this tree needs, so it hardcodes a 256 MiB vertex
  buffer refusal and an 8192 canvas dimension no spec floor backs.

**The trade runs the other way, which is useful for triage.** One shared device
means one `device.lost` takes down every display, and per-device limits are a
single budget. So _one track broke_ points at WebGL2, _every track broke at
once_ points at WebGPU.

## Why not Rust in the browser

Rust lands on one of the
[three clocks](/docs/developer_guides/optimizations#three-clocks) a track's cost
splits into, and none is waiting on a faster language.

- **The fetch clock is already compiled.** Decompression is 70-90% of a cold
  query and runs through libdeflate in wasm, at parity with native `zlib`. What
  is left is record building, where a byte-level scan measured slower than the
  string chain it would replace — V8's sliced strings are nearly free.
- **The frame clock is not compute.** Frame time scales with CPU throttle while
  the RPC workers profile idle, and what runs is
  [React re-render](/docs/developer_guides/optimizations#interaction-cost-is-react-re-render)
  and CSS-in-JS.
- **The load clock gets worse.** A wasm module is bytes every host evaluates
  before a plugin can register, and
  [six pins](/docs/developer_guides/optimizations#the-load-clock) went into
  shrinking that budget.
- **Hand-tuned kernels are not free either.** Two rewrites of a MAF worker loop
  [measured worse than the plain loop](/docs/developer_guides/optimizations#two-kernels-that-look-like-wins-and-are-not).
  The shape of the memory access is what moves it, and that is visible in
  TypeScript.

## Where Rust earns it

Three places, sharing one property: it runs before the page does, or is small
enough that its bytes disappear.

- **The decompression kernel.** `@gmod/bgzf-filehandle` and `@gmod/bbi` inflate
  through a Rust crate — `wasm-bindgen` over `libdeflater` — compiled to wasm
  and inlined. It is the measured majority of a cold query, a batch entry point
  inflates a whole run of blocks in one crossing, and the module is tens of
  kilobytes rather than megabytes. That last is the criterion the others rest
  on.
- **Offline preprocessors.** `maf2bed`, a Rust CLI on crates.io, writes the
  coarse summary tier a whole-chromosome MAF view reads. It moves work out of
  the browser rather than making the browser faster at it —
  [what the data provider controls](/docs/developer_guides/optimizations#what-the-data-provider-controls).
- **Build tooling.** CI validates every generated WGSL shader with `naga`, the
  wgpu project's own compiler, installed with `cargo install`. A Rust binary in
  CI costs a cache entry; the same compiler shipped to readers costs every page
  load, which is why wgpu is on both lists.

## How the decision gets made

Identify which clock a change lands on, measure it against the code it would
replace, and keep the result when it is a loss.
[](/docs/developer_guides/optimizations) publishes those beside the
wins and
[REJECTED_IDEAS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REJECTED_IDEAS.md)
is the longer list. If a library now clears the three constraints at the top,
that is a measurement worth taking, and
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md)
is how to take one that holds up.
