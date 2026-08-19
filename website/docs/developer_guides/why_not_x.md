---
title: Why not deck.gl, Pixi, Rust or wgpu
description:
  The rendering engines and languages we evaluated instead of writing our own
  backend, why the ladder targets WebGPU rather than WebGL2 alone, what we took
  from GenomeSpy, and where Rust does earn its place
guide_category: Advanced topics
---

**TL;DR:** JBrowse draws through a small hand-written backend rather than
deck.gl, Pixi, Three.js or wgpu, and its hot loops are TypeScript rather than
Rust. Each of those was evaluated against the constraints this renderer actually
has — a Canvas2D floor, typed arrays that are never converted, and genomic
coordinates too large for float32 — and none of them covered those. WebGPU is on
the ladder above WebGL2 because a page gets sixteen WebGL2 contexts and one
linear view can spend them all. Rust is in the tree in three places, all of them
where a compiled binary costs the page nothing.

Each candidate below solves a real problem well. What this page records is which
problem that is, and which of ours it leaves for us.

## The constraints a candidate has to meet

Read these first, because every rejection below is one of them.

**Canvas2D is the floor, not a fallback.** Every canvas-drawing display ships a
Canvas2D draw function, and [SVG export](/docs/developer_guides/svg_export)
calls that same function rather than the shader. Two things follow. On-screen
and exported pixels cannot drift, because one piece of code produces both. And a
GPU library, however good, is a third rendering path we would have to keep in
parity with the two that already exist. A Canvas2D path is also what runs when
there is no usable GPU at all — headless capture, software rasterization, an old
machine — and under software rendering it is the faster one.

**The bytes are the worker's output and the graphics card's input,
unconverted.** A track's data is decoded in an RPC worker into
[one typed array per attribute](/docs/developer_guides/optimizations#the-worker-boundary),
crosses `postMessage` as a transferable, and is uploaded without being read.
That is [the largest single win](/docs/developer_guides/optimizations) in the
renderer, and it holds only while nothing in the chain converts between
representations. A retained-mode scene graph — an object per feature, mutated
per frame — is the shape that breaks it.

**Coordinates are absolute genomic `uint32`, split in the shader.** float32
cannot hold a position above about 16 Mbp exactly, so the shader
[cuts each coordinate into a high and a low half](/docs/developer_guides/optimizations#coordinates-are-absolute-uint32-split-in-the-shader)
and subtracts them separately. A candidate library either carries its own
double-single emulation or it does not, and without one chromosome-scale
positions come out wrong in a way that reads as jitter rather than as an error.
GenomeSpy is the project that had it, and taking that one piece from it is what
the section below describes.

## The rendering libraries

| candidate                 | what it is                                        | why not here                                                                              |
| ------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| deck.gl (over luma.gl)    | layer framework for large geospatial overlays     | portable API, but shaders still written per backend, and no Canvas2D path                 |
| Pixi                      | 2D scene graph, WebGL and WebGPU                  | composable shader bits pay off when features are remixed; ours are fixed programs         |
| Three.js (and TSL)        | 3D scene graph with a node-graph shading language | dual output works, but the node-graph model replaces the explicit shaders we already have |
| regl                      | thin functional WebGL wrapper                     | WebGL only, so it cannot carry the WebGPU path                                            |
| wgpu compiled to wasm     | Rust GPU abstraction                              | megabytes into every page load, over a WebGL fallback we would then be debugging          |
| Babylon.js runtime Tint   | transpiles shaders in the browser                 | ships compiler bytes to every reader and moves cross-compile failures into production     |
| WebGPU Compatibility Mode | one API over older GPU feature levels             | requires a secure context we cannot require of every deployment                           |

[ADR-005](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md)
records that evaluation, along with the one it accepted: shaders are authored
once in Slang and cross-compiled to WGSL and GLSL ES at build time.

**deck.gl** is the closest fit of the group. It takes binary attributes without
building objects, so the typed-array constraint is not the objection. What it
leaves is the other two. luma.gl's portable API still means writing a shader per
backend, because WebGPU reads instance data from storage buffers and WebGL2 has
no storage buffers at all and must read vertex attributes instead — the same
split that made Slang worth adopting. And deck.gl has no Canvas2D backend, so
SVG export would need a second implementation of every glyph, which is exactly
the drift the shared draw function exists to prevent.

**Pixi** is what HiGlass renders through, and it is a reasonable choice for a
browser built around tiles. The investigation that considered a Pixi-style
runtime abstraction over our three backends found the payoff missing rather than
the design wrong: composable shader fragments earn their indirection when a
renderer remixes dozens of features into new programs, and JBrowse has a handful
of fixed programs that are never remixed. Pixi's display list is also the
retained-mode shape the worker's typed arrays are built to skip.

**Three.js** is a 3D engine, and a genome view is a stack of orthographic 2D
strips. Its TSL node graph is a proven way to emit both WGSL and GLSL from one
source, which is the same problem Slang solves — the difference is that Slang
takes shader code we can read next to the pipeline that binds it, and TSL
replaces it with a graph.

**wgpu** is a Rust abstraction over the same browser WebGPU API our HAL already
calls, so in a page it buys an indirection rather than a capability. Measured as
a candidate it costs roughly ten megabytes of wasm and brings a WebGL fallback
we would own the bugs in. We do use the wgpu project, though — see below.

**[GenomeSpy](https://genomespy.app/) is the one on this list that had already
hit the same wall**, and its answer is in our shaders. It is a WebGL2 toolkit
for genomic visualization built around a declarative grammar, and it solved the
float32 coordinate problem with the same high/low split described above. We
adopted that technique directly rather than reimplementing it —
`packages/render-core/src/shaders/hpmath.slang` carries the attribution and the
MIT notice, and `hpSplitUint` is the function. What we did not adopt is the
layer above it: a grammar is a language you author a visualization in, and
JBrowse's rendering sits underneath a plugin-registered display API, where the
thing being composed is a track someone else's plugin contributed. Borrowing the
kernel and leaving the composition model is the shape most of this page argues
for.

**A note on rewriting from scratch.** A previous attempt wrote its own
mini-compiler for the dual-shader problem, shipped malformed syntax, and was
abandoned. That is on the record here because it is the failure mode of the
"just write it ourselves" instinct that this page could otherwise be read as
endorsing.

## Why WebGPU, and not WebGL2 on its own

WebGL2 is the older API, it is available on more machines, and JBrowse ships a
complete WebGL2 backend — so targeting WebGPU as well is a cost that has to earn
itself. It does, and the first reason is a hard ceiling rather than a
preference.

**A page gets sixteen WebGL2 contexts.** One display owns one canvas and one
context, with no pooling, so contexts are open GPU tracks and the ceiling is a
track budget. Past it the browser evicts a context, the display re-acquires,
that acquisition evicts another, and the cascade wedges the main thread instead
of degrading. **A single ordinary linear view reaches it** at seventeen GPU
tracks — no many-view session, nothing synthetic. View-level lazy mounting
bounds the common case, and bounds nothing in a multi-panel workspace where
every panel is on screen at once.

WebGPU has no equivalent cap. `packages/render-core/src/gpuDevice.ts` holds one
page-wide `GPUDevice`, and every display's canvas is configured against it, so
adding a track costs a swap chain rather than a driver context. That is the
primary motivation for targeting WebGPU at all, and
[GPU_CONTEXT_BUDGET.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/GPU_CONTEXT_BUDGET.md)
owns the measurement, along with the four alternative fixes that were tried and
eliminated.

Three more differences matter to the code that sits on top:

- **Instance data has no size cliff.** WGSL reads per-instance data out of a
  storage buffer, and GLSL ES 3.00 has no storage buffers at all — the
  alternatives are vertex attributes or a uniform block capped near 64 KB, which
  a realistic render passes at a few thousand instances. That split is what
  makes the two shaders structurally different, and it is why the shader source
  is cross-compiled rather than shared at runtime.
- **Antialiasing exists.** The WebGPU backend renders 4x MSAA through a resolve
  texture. WebGL2 has no equivalent here, so a diagonal edge is simply harder.
- **Limits are queryable.** The WebGPU HAL reads every limit it depends on from
  `device.limits` at runtime and reports the two its guards trip on. WebGL2 can
  ask for neither of the ones this tree needs, so it hardcodes a 256 MiB vertex
  buffer refusal and an 8192 canvas dimension that no spec floor backs. Guessing
  is not a style choice there; there is no call to make.

**The trade runs the other way too, and it is worth knowing for triage.** One
shared device means one `device.lost` takes down every display at once, and the
per-device limits are a single budget rather than a per-track one. So the two
backends fail in opposite directions: _one track broke_ points at WebGL2 and its
per-canvas context, _every track broke at once_ points at WebGPU and its shared
device. Neither replaces the other, which is why the ladder is WebGPU → WebGL2 →
Canvas2D rather than a choice.

## Why not Rust in the browser

Rust would land on one of the three clocks a track's cost splits into, and
[none of them is waiting on a faster language](/docs/developer_guides/optimizations#three-clocks).

**The fetch clock is already compiled.** Decompression is 70-90% of a cold
query's wall time, and it runs through libdeflate in WebAssembly, at parity with
native `zlib`. A rewrite there competes with a compiled decompressor, not with
JavaScript. What is left is record building, a small fraction of the query, and
the one time a byte-level scan was measured against the string chain it would
replace it came out slower — V8's sliced strings are already nearly free on the
line lengths genomics formats produce.

**The frame clock is not compute.** Frame time during a pan or zoom scales with
CPU throttle while the RPC workers profile completely idle, and what runs is
React re-render and CSS-in-JS. No compiled language reaches that; the lever is
how many components re-render per frame, which is what
[the scalebar fix](/docs/developer_guides/optimizations#interaction-cost-is-react-re-render)
changed.

**The load clock gets worse.** A wasm module is bytes every host downloads and
evaluates before a plugin can register, and
[six separate pins](/docs/developer_guides/optimizations#the-load-clock) went
into shrinking that budget. A general-purpose Rust runtime spends the win.

**Hand-tuned kernels are not free wins either.** Two rewrites of a hot loop in
the multiple-alignment worker — transposing its walk, and reading four columns
at a time through a `Uint32Array` — both
[measured worse than the plain loop](/docs/developer_guides/optimizations#two-kernels-that-look-like-wins-and-are-not),
and the one that looked like a large win turned out to be a semantic change
priced. Compiling the same loop to wasm has the same problem: the shape of the
memory access is what moves it, and that is visible in TypeScript.

## Where Rust does earn it

Rust is in the stack in three places, and they share a property — it runs before
the page does, or in a kernel small enough that its bytes disappear.

**The decompression kernel.** `@gmod/bgzf-filehandle` and `@gmod/bbi` both
inflate through a small Rust crate — `wasm-bindgen` over `libdeflater` —
compiled to wasm and inlined into the bundle. Three things make it worth having:
decompression is the measured majority of a cold query, a batch entry point
inflates a whole run of blocks in one JavaScript-to-wasm crossing, and the
compiled module is tens of kilobytes rather than the megabytes a general-purpose
runtime costs. The third is the criterion the other two rest on — a wasm payload
has to be small enough that the load clock does not eat the fetch clock's win.

**Offline preprocessors.** `maf2bed` is a Rust CLI on crates.io that writes the
coarse summary tier a whole-chromosome multiple-alignment view reads. A native
binary a data provider runs once has no bundle cost at all, and it moves work
out of the browser entirely rather than making the browser faster at it — which
is the same reasoning behind
[everything the data provider controls](/docs/developer_guides/optimizations#what-the-data-provider-controls).

**Build and CI tooling.** Every generated WGSL shader is validated in CI by
`naga`, which is the wgpu project's own shader compiler, installed with
`cargo install`. A Rust binary in a CI job costs a cache entry. The same
compiler shipped to readers, as Babylon.js does, costs every page load — which
is why it is on the rejected list above and in the CI job at the same time.

## How the decision gets made

The pattern across all of this is one rule: **identify which clock a change
lands on, measure it against the code it would replace, and keep the result even
when it is a loss.** The losses are the useful half —
[optimizations](/docs/developer_guides/optimizations) publishes them next to the
wins, and
[REJECTED_IDEAS.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/REJECTED_IDEAS.md)
is the longer list, so a reader deciding what to try next does not re-run an
experiment that already came back negative.

If one of these libraries would now clear the three constraints at the top — a
Canvas2D or SVG path, binary attributes end to end, and coordinates that survive
a chromosome — that is a measurement worth taking, and
[BENCHMARKING.md](https://github.com/GMOD/jbrowse-components/blob/main/agent-docs/reference/BENCHMARKING.md)
is how to take one that holds up.
