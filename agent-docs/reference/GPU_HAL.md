---
name: gpu-hal
description: What traps does the GPU hardware abstraction layer carry — "pass" naming, buffer replacement, WebGL2 context budget, WebGPU swap-chain ownership — and which real-time-rendering techniques does the GPU path deliberately omit?
kind: spec
---

# The GPU HAL and what the GPU path omits

The HAL hides the WebGPU/WebGL2 difference and lives in
`packages/render-core/src/hal/`; `hal/types.ts` is the interface.
[GPU_RENDERING.md](GPU_RENDERING.md) is the hub.

## "Pass" means pipeline, not WebGPU's render pass

`PipelineDescriptor` is a pipeline state object, compiled to one
`GPURenderPipeline` (`resolvePipelines`, `webgpuHal.ts`) or one linked program +
VAO (`link`, `webgl2Hal.ts`). The identifiers around it still say "pass"
(`passId`, `drawPass`, `slangPass`, `InstancePass`, `*_PASSES`); read each as
"pipeline". The rename stopped at the type because `passId` is a join key across
hundreds of call sites. `drawPass` binds a pipeline and a region's buffer and
issues one instanced draw. WebGPU's render pass is the `beginFrame`/`endFrame`
bracket, one per frame.

**The two HALs build pipelines at opposite times.** WebGL2 builds on first draw
(`getPass`), keeping one canary link in the constructor so a GL stack that cannot
compile our shaders falls to Canvas2D. WebGPU resolves the whole declared list
before `WebGPUHal.create` returns; `hal/deviceGpuCache.ts` memoizes pipelines per
device. Why going lazy costs more:
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md#every-webgpu-display-resolves-its-whole-pass-list-before-it-can-paint).

**Both HALs key a compile by what it compiles, never by the pass id**, so the key
cannot miss an input. `deviceGpuCache.test.ts` and `webgl2HalPrograms.test.ts`
pin both.

**`?renderer=webgpu` pins that rung and does not fall past it.** A pinned
renderer that silently substitutes another makes every comparison wrong, so
`createGpuHal` raises a `renderError` naming the pin. Prove which backend ran by
asserting on the HAL, not the URL.

**`bufferPassId` shares an instance buffer between passes** (chevron off line's,
continuation off rect's). `sharedInstanceBuffers.test.ts` pins the shared struct
layout, but no unit test sees whether each HAL binds the offsets it was handed;
that shows only as garbled geometry on a GPU machine, and
`browser-tests/probe-continuation-strand.ts` checks it.

**An empty upload IS the release.** Every HAL deletes the pass's prior buffer
before looking at the count, so `uploadBuffer(key, pass, data, 0)` means "nothing
this time". Skipping the call to save an upload leaves the previous frame's bytes
on the GPU.

**Replacing a buffer mid-frame is legal because WebGPU defers the release.**
`destroy()` is validated against `queue.submit`, so freeing a buffer an open pass
already drew from fails the whole command buffer, blanking every track in the
frame with only a console validation error. `WebGPUHal` queues releases on
`pendingDestroy` while `currentEncoder` is non-null and drains them after submit
in `endFrame`. `MockHal.replacedWhileDrawn()` is where a renderer test says which
shape it has.

`GpuHalBase` owns the shared shells (`uploadBuffer`/`uploadTexture` with their
over-limit refusals, `setErrorHandler`, once-only `dispose`); leaves supply
`limits()`, `createBuffer`, `destroyBuffer`, `createTexture`, `releaseResources`.

## WebGL2 contexts are a page-level budget, one per display

`WebGL2Hal` takes its own `getContext('webgl2')` with no pooling, and each
display owns one backend canvas. The count to watch is open GPU tracks;
chromosomes are free (a whole-genome view is one canvas, one buffer per
`displayedRegionIndex`). `WebGPUHal` has no cap, since every display shares the
`gpuDevice.ts` singleton, a primary reason the GPU path targets WebGPU.
`stopRenderingBackend` + `dispose()` on unmount returns a context. The cap and
the mitigations: [GPU_PORTABILITY.md](GPU_PORTABILITY.md) and
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"One WebGL2 context per
display canvas".

**A failed device acquisition is cached, except after a loss.** `getGpuDevice()`
memoizes its promise, but the re-init after `device.lost` asks for an adapter
within a frame of the loss, when `requestAdapter` still declines on sleep/wake or
a driver reset, and caching that pins the page to WebGL2 until reload.
`gpuDevice.ts` tracks `hadDevice` and past that point retries and never caches a
failure.

## A WebGPU canvas's configuration belongs to the element, not to the HAL

`canvas.getContext('webgpu')` returns the same `GPUCanvasContext` every time, so
the swap chain is per-element state. Two HALs can share one (a `model` prop swap,
an init overlapping a cancelled one), and `WebGPUHal.dispose()`'s `unconfigure()`
then releases the live HAL's. Firefox answers every later frame with
`InvalidStateError: ... Canvas not configured`, and there is no context-lost
event, so recovery never runs. `canvasConfiguredBy` (`canvasContext.ts`) lets
`dispose()` release only its own configuration, and a frame that finds the swap
chain gone rebuilds it. Reproduce with
`products/jbrowse-web/browser-tests/swapchain-steal-probe.ts`.

## What this architecture deliberately does not have

Each entry is a standard real-time-rendering technique a reader with a
game-engine background will reach for.

**Render graph / frame graph.** One render pass, one colour attachment, no
offscreen targets and no pass consuming another's output. Ordering is a static
z-ordered mark list (`PILEUP_MARKS`) and resource lifetime is `RegionRegistry`'s.
See the layer-manifest decline and its overturn in
`agent-docs/architecture-decision-records/`.

**Indirect drawing.** The instance count is `byteLength / instanceStride` of a
CPU-packed buffer, so there is no roundtrip to remove. Reopen it for a pass whose
instances a compute kernel produces.

**GPU-driven culling.** Culling stays CPU-side. Declined twice with numbers:
dotplot (quads of a few px, which the rasterizer discards as cheaply as a vertex
test) and hi-C contacts by distance from the diagonal. Synteny's `isCulled` earns
its place because its quads span the track.

**Storage buffers (SSBO) in the render path.** Slang cross-compiles to GLSL ES
3.0, which has no SSBOs, so adopting them forks every shader. Per-instance data
is one instance reading its own fixed struct, which vertex fetch serves; the
largest struct (`read.slang`) takes 10 attributes against a limit of 16
([GPU_PORTABILITY.md](GPU_PORTABILITY.md)).

**Depth buffer / early-Z.** Every pass blends, and blending composes correctly
only in draw order. A depth test rejects exactly the fragment a translucent mark
behind it should show through.

**Persistent staging / mapped buffers.** Uploads use `queue.writeBuffer` and
`gl.bufferData`, never a `mapAsync` ring; `writeBuffer` is the browser's staging
ring minus the round trip.

**Compute where a CPU fallback must exist anyway.** Compute is right when the CPU
fallback is "the feature does not exist". The LD kernels passed;
`ideas/waiting-on-a-call/gpu-sample-distance-matrix.md` applies the criterion to
the next candidates. Instance packing fails it: Canvas2D is a mandatory floor, so
a compute packer would be a second packer emitting bytes the first must match,
the drift `packInstances()` exists to prevent.

**Spatial acceleration structures for culling.** Flatbush indexes hit-testing and
picking, never what to draw; `view.displayedRegions` is already the partition.

**Draw-call batching.** One instanced draw per `(pass, region)` with data. A row
inside one instance buffer is already one draw, measured draws per frame are in
the tens (table below), and frames are main-thread bound
([INTERACTION_PERF.md](INTERACTION_PERF.md)). Merging would cross region
boundaries, where scissor, viewport and per-block uniforms change.

**Buffer pooling / sub-allocation.** `uploadBuffer` destroys and recreates one
`GPUBuffer` per `(regionKey, passId)` per upload. Measured and declined: a pan
allocates at the fetch cadence, a pan inside loaded blocks allocates none, and
time inside create calls is a negligible share of the gesture. A display whose
uploads arrive per frame would reopen it; none does
([GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md) §"Upload patterns").

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
adds a pass and a readback before the same `findRead` lookup, and it would be a
third hit-test implementation since the Canvas2D floor needs an analytic one. A
non-rectangular mark tested by approximation is fixed by deriving the predicate
from the shader ([GPU_BACKENDS.md](GPU_BACKENDS.md) §"Keeping the two backends in
parity").

**Runtime shader generation.** Shaders are `.slang` compiled ahead of time, so a
worker that cannot import the plugin still packs bytes that provably match its
struct (`packInstances` and `INSTANCE_OFFSET` come from the same compile). Runtime
codegen forfeits that and invites the float-bits-in-a-`uint` bug. See ADR-051 and
[ADR-095](../architecture-decision-records/adr-095-a-shape-composes-a-scale-at-compile-time.md).

**Nested render scopes / group opacity.** The pass list is flat and z-ordered; a
track is a display is a canvas, and displays do not nest.
