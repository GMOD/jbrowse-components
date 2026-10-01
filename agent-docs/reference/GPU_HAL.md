---
name: gpu-hal
description: How does the hardware abstraction layer behave — pipeline objects versus render passes, when each HAL compiles, buffer replacement, the WebGL2 context budget, WebGPU swap-chain ownership — and which real-time-rendering techniques does the GPU path deliberately omit?
kind: spec
---

# The GPU HAL and what the GPU path omits

The HAL hides the WebGPU/WebGL2 difference and lives in
`packages/render-core/src/hal/`. The full interface is `hal/types.ts`.
[GPU_RENDERING.md](GPU_RENDERING.md) is the hub.

## The remaining "pass" names mean the pipeline, not WebGPU's render pass

**`PipelineDescriptor` is a pipeline state object.** It carries shader source,
vertex layout, blend state, topology and texture bindings, and compiles to one
`GPURenderPipeline` (`resolvePipelines`, `webgpuHal.ts`) or one linked program +
VAO (`link`, `webgl2Hal.ts`). **The identifiers around it still say "pass"**
(`passId`, `drawPass`, `slangPass`, `InstancePass`, `*_PASSES`); read each as
"pipeline". The rename stopped at the type because `passId` is a join key spelled
identically across hundreds of call sites.

**WebGPU's render pass is the `beginFrame`/`endFrame` bracket**: exactly one per
frame, with the MSAA attachment and resolve target. Batching the frame into one
pass resolves MSAA once instead of per draw.

| Reads like | Actually is |
|---|---|
| `drawPass(passId, regionKey)` | bind PSO `passId`, bind that region's vertex buffer, issue **one instanced draw**; does not begin a pass |
| `beginFrame` / `endFrame` | open and close **the** render pass, plus command encoder and submit |

**The two HALs build pipelines at opposite times.** WebGL2 builds on first
*draw* (`getPass`), keeping one canary link in the constructor so a GL stack that
cannot compile our shaders falls to Canvas2D. WebGPU resolves the whole declared
list before `WebGPUHal.create` returns, so first paint waits on every pass;
measured, that is cheap (concurrent, off the main thread), and
`hal/deviceGpuCache.ts` memoizes pipelines per device so displays share them.
Why going lazy would cost more:
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#every-webgpu-display-resolves-its-whole-pass-list-before-it-can-paint).

**Both HALs key a compile by what it compiles, never by the pass id.** WebGPU
keys a `PipelineRecipe` (WGSL, vertex layout, blend, topology, textured, sample
count), so the key cannot miss an input. WebGL2 keeps a per-context map (a
program belongs to its context) keyed on vertex source, fragment source,
attribute names and sampler unit. `deviceGpuCache.test.ts` and
`webgl2HalPrograms.test.ts` pin both.

```
createGpuHal(canvas, { passes, sampleCount }): Promise<GpuHal | null>
  ?renderer=canvas2d|canvas  → null                     (Canvas2D backend)
  ?renderer=webgl            → skip WebGPU, try WebGL2 → null on failure
  ?renderer=webgpu           → WebGPU only, error on failure
  otherwise                  → WebGPU → WebGL2 (not on a software rasterizer) → null
```

**`?renderer=webgpu` pins that rung and does not fall past it.** A pinned
renderer that silently substitutes another makes every comparison wrong, so
`createGpuHal` raises a `renderError` naming the pin, with "use Canvas2D" as the
way out. Prove which backend ran by asserting on the HAL, not the URL.

`bufferPassId` on `drawPass` lets one pass draw off another's instance buffer
(chevron off line's, continuation off rect's). Each pair declares one shared
struct (`lineInstance.slang`, `rectInstance.slang`) and
`sharedInstanceBuffers.test.ts` pins the layout. No unit test sees whether each
HAL binds the offsets it was handed (`vertexAttribPointer` for WebGL2,
`vertex.buffers` for WebGPU); that shows only as garbled geometry on a GPU
machine, and `browser-tests/probe-continuation-strand.ts` checks it.

**An empty upload IS the release.** Every HAL deletes the pass's prior buffer
before looking at the count, so `uploadBuffer(key, pass, data, 0)` means "nothing
this time", and `uploadPass` passes an empty pack through. Skipping the call to
save an upload leaves the previous frame's bytes on the GPU.

**Replacing a buffer mid-frame is legal because WebGPU defers the release.**
`destroy()` is validated against `queue.submit`, so freeing a buffer an open pass
already drew from fails the **whole** command buffer, blanking every track in the
frame with only a console validation error. `WebGPUHal` pushes every release onto
`pendingDestroy` while `currentEncoder` is non-null and drains it after submit in
`endFrame` (also on the throwing path, and in `dispose`), through the
`RegionRegistry` destroy hook. WebGL2 is immediate-mode and needs none of this.
`MockHal.replacedWhileDrawn()` is where a renderer test says which shape it has.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery), `WebGL2Hal`
(`antialias` above one sample, VAO + UBO, context-loss recovery), `MockHal`
(tests). Both real HALs take the display's sample count, 1 where every pass
declares `//! coverage: analytic`. All three extend `GpuHalBase`, which owns the
descriptor map, the `RegionRegistry`, the `uploadBuffer`/`uploadTexture` shells
with their over-limit refusals, `setErrorHandler` and the once-only `dispose`. A
leaf supplies `limits()`, `createBuffer`, `destroyBuffer`, `createTexture` and
`releaseResources`. `MockHal` overrides the shells to log and then calls
`super`. `gpuHalBase.test.ts` pins the refusals.

## WebGL2 contexts are a page-level budget, one per display

`WebGL2Hal` takes its own `getContext('webgl2')` with no pooling, and each
display owns one backend canvas. The count to watch is **open GPU tracks**;
chromosomes are free (a whole-genome view is one canvas, one buffer per
`displayedRegionIndex`, drawn as scissored blocks). `WebGPUHal` has no cap, since
every display shares the `gpuDevice.ts` singleton, **a primary reason the GPU
path targets WebGPU.**

- `stopRenderingBackend` + `dispose()` on unmount returns a context. Views
  lazy-mount (`useViewVisibility.ts`); tracks within a view do not yet.
- `?renderer=canvas2d` allocates none.

The cap, what happens past it and the mitigations:
[GPU_PORTABILITY.md](GPU_PORTABILITY.md) and
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"One WebGL2 context per
display canvas". Don't restate the numbers here.

**A failed device acquisition is cached, except after a loss.** `getGpuDevice()`
memoizes its promise, so null normally means "no WebGPU here". But the re-init
after `device.lost` asks for an adapter within a frame of the loss, when
`requestAdapter` still declines on sleep/wake or a driver reset, and caching that
pins the page to WebGL2 until reload. `gpuDevice.ts` tracks `hadDevice` and past
that point retries (3 × 700 ms) and never caches a failure.

## A WebGPU canvas's configuration belongs to the element, not to the HAL

`canvas.getContext('webgpu')` returns the **same** `GPUCanvasContext` every time,
so the swap chain is per-element state. Two HALs can share one (a `model` prop
swap, an init overlapping a cancelled one), and `WebGPUHal.dispose()`'s
`unconfigure()` then releases the live HAL's. Firefox answers every later frame
with `InvalidStateError: ... Canvas not configured`, and there is **no
context-lost event** for it, so recovery never runs and the raw DOMException
banners until reload. `unconfigure()` is the only thing that drops the
configuration; `device.destroy()`, detach/reattach, resize, `display: none` and
a hidden tab do not.

Two guards in `webgpuHal.ts`: `canvasConfiguredBy` (`canvasContext.ts`) lets
`dispose()` release only its own configuration, and a frame that finds the swap
chain gone rebuilds it and paints. A rebuild that fails is reported once through
the error handler, not retried. Reproduce with
`products/jbrowse-web/browser-tests/swapchain-steal-probe.ts`.

## What this architecture deliberately does not have

Each entry is a standard real-time-rendering technique a reader with a
game-engine background will reach for. The reason it is absent is stated in
that vocabulary.

**Render graph / frame graph.** Ours has one render pass, one colour attachment,
no offscreen targets and no pass consuming another's output. Ordering is a
static z-ordered mark list (`PILEUP_MARKS`, the coverage band's) and resource
lifetime is `RegionRegistry`'s. A shared list of layer ids with z-order and gates
plus a `Record<LayerId, …>` per backend is narrower than a frame graph: no
dependencies, no targets, no scheduling. See the layer-manifest decline and its
overturn in `agent-docs/architecture-decision-records/`.

**Indirect drawing.** The instance count is already the packed buffer's
`byteLength / instanceStride`, computed CPU-side, so there is no roundtrip to
remove. **The condition:** this holds while every instance buffer is packed
CPU-side. The day a compute kernel produces a pass's instances, reopen it for
that pass.

**GPU-driven culling.** Culling stays CPU-side. Declined twice with numbers:
dotplot (quads of a few px, which the rasterizer discards as cheaply as a vertex
test) and hi-C contacts by distance from the diagonal. Synteny's `isCulled`
earns its place because its quads span the track.

**Storage buffers (SSBO) in the render path.** Every pass feeds per-instance data
through a vertex buffer with `stepMode: 'instance'`. Slang cross-compiles to GLSL
ES 3.0, which has no SSBOs, so adopting them forks every shader. And the access
pattern is one instance reading its own fixed struct sequentially, which vertex
fetch serves; the largest instance struct (`read.slang`) takes 10 attributes
against a limit of 16 ([GPU_PORTABILITY.md](GPU_PORTABILITY.md)). GenomeSpy's
generic `rect` mark needs ~28 channels, so its storage buffers follow from
generic marks; ours are specific.

**Depth buffer / early-Z.** No pass declares depth-stencil state. Every pass
blends (`premultiplied`, `max` on the wiggle centre line, `behind` on the
whiskers band), and blending composes correctly only in draw order. A depth test
rejects exactly the fragment a translucent mark behind it should show through.
Order is the correctness mechanism; early-Z would save only opaque overdraw the
rasterizer already discards cheaply.

**Persistent staging / mapped buffers.** Uploads use `queue.writeBuffer` and
`gl.bufferData`, never a `mapAsync` ring. `writeBuffer` is the browser's staging
ring, minus the `mapAsync` round trip. The uniform ring (`uniformRingBuffer`)
turns per-draw uniform writes into one frame-level copy, not to avoid allocation.

**Compute where a CPU fallback must exist anyway.** Compute is right when the CPU
fallback is "the feature does not exist", and wrong when a CPU fallback must
exist anyway. The LD kernels passed (O(n²) pairwise, parallel, a CPU version too
slow to be a fallback); `ideas/waiting-on-a-call/gpu-sample-distance-matrix.md`
applies the criterion to the next candidates. Instance packing fails it:
Canvas2D is a mandatory floor, so a compute packer would be a second packer
emitting bytes the first must match, the drift `packInstances()` exists to
prevent. The cost sits in branchy BAM/CRAM decode and row assignment anyway.
`createInstanceCache` already covers re-deriving from resident data.

**Spatial acceleration structures for culling.** Flatbush indexes
**hit-testing and picking**, never what to draw. The genome axis is 1D and
`view.displayedRegions` is already the spatial partition.

**Draw-call batching.** One instanced draw per `(pass, region)` with data. Our
analogue of GenomeSpy's sample-facet coalescing is a row inside one instance
buffer, already one draw. Measured draws per frame are in the tens, not the
thousands where a budget binds (table below), and frames are main-thread bound
([INTERACTION_PERF.md](INTERACTION_PERF.md)). Merging would have to cross region
boundaries, where scissor, viewport and per-block uniforms change.

**Buffer pooling / sub-allocation.** `uploadBuffer` destroys and recreates one
`GPUBuffer` per `(regionKey, passId)` per upload. **Measured and declined**: a
pan allocates buffers at the fetch cadence (one per pass per newly fetched block),
a pan inside loaded blocks allocates none, and time inside create calls is a
negligible share of the gesture. WebGL2 is the rung to read, since `bufferData`
allocates synchronously. What would reopen it is a display whose uploads arrive
per frame; none does ([GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md) §"Upload patterns").

<!-- BEGIN GENERATED MEASUREMENT buffer-churn-pan -->

_Generated by `pnpm autogen` — edit the source, not this block._

| scenario                        | rung   | buffers created |   bytes | buffers freed | time in create | gesture wall | create share | draws/frame | draws/frame max |
| ------------------------------- | ------ | --------------: | ------: | ------------: | -------------: | -----------: | -----------: | ----------: | --------------: |
| two alignments tracks, pan      | WebGPU |          **24** | 1468 KB |            20 |     **0.40ms** |      10784ms |       0.004% |          10 |              48 |
| two alignments tracks, pan back | WebGPU |              24 | 1387 KB |            28 |         0.20ms |       6614ms |       0.003% |          14 |              62 |
| two alignments tracks, 1 px pan | WebGPU |               0 |    0 KB |             0 |         0.00ms |       7930ms |       0.000% |          10 |              20 |
| two alignments tracks, pan      | WebGL2 |          **26** | 1459 KB |            20 |     **0.90ms** |      23991ms |       0.004% |          16 |              50 |
| two alignments tracks, pan back | WebGL2 |              10 |  674 KB |            16 |         0.10ms |       5117ms |       0.002% |          16 |              52 |
| two alignments tracks, 1 px pan | WebGL2 |               0 |    0 KB |             0 |         0.00ms |       4998ms |       0.000% |          10 |              20 |
| one alignments track, pan       | WebGPU |              12 |  733 KB |            10 |         0.10ms |       6126ms |       0.002% |           5 |              24 |
| one alignments track, pan back  | WebGPU |              12 |  632 KB |            14 |         0.00ms |       4018ms |       0.000% |           7 |              28 |
| one wiggle track, pan           | WebGPU |               2 |    5 KB |             2 |         0.00ms |       3457ms |       0.000% |           1 |               3 |

<!-- END GENERATED MEASUREMENT buffer-churn-pan -->

**GPU picking (id pass plus readback).** Hit-testing is analytic and CPU-side.
Picking returns a pixel id, but every consumer needs the feature record, so it
adds a pass and a readback before the same `findRead` lookup. It would also be a
*third* hit-test implementation, since the Canvas2D floor needs an analytic one,
and `readPixels` blocks on WebGL. GenomeSpy's arbitrary SDF shapes make the pixel
id the answer there. Our one real weakness, a non-rectangular mark tested by
approximation, is fixed by deriving the predicate from the shader
([GPU_BACKENDS.md](GPU_BACKENDS.md) §"Keeping the two backends in parity").

**Runtime shader generation.** Shaders are `.slang` compiled ahead of time, so a
worker in a package that cannot import the plugin still packs bytes that provably
match its struct (the generated `packInstances` and `INSTANCE_OFFSET` come from
the same compile). Runtime codegen forfeits that and invites the float-bits-in-a-`uint`
bug. See ADR-051 and
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md);
`SESSION_SPEC_FORMAT.md` asks the same question one level up.

**Nested render scopes / group opacity.** The pass list is flat and z-ordered.
GenomeSpy has scopes because its specs are trees of views whose opacity must
composite as a group. A track is a display is a canvas, displays do not nest, and
the shared-canvas views are flat co-tenancy.

