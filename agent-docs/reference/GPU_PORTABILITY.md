---
name: gpu-portability
description: What this codebase requires of a GPU against what WebGPU and WebGL2 guarantee everywhere — which limits are queried, which are hardcoded, and each shader's headroom over the floor. Read before trusting a GPU number measured on one machine.
audience: internal
kind: spec
---

# GPU portability: what is guaranteed, and what is one laptop

Every GPU number this repo records comes from one integrated-GPU machine.
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) and
[GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md) say so in each entry's provenance
line. This doc answers the other question, **what is true on hardware we have
never seen?**, by comparing the published spec minimums against what the tree
queries or bakes in. None of it needs hardware.

The floors below come from the WebGPU limits table and the OpenGL ES 3.0
implementation-dependent values that WebGL2 inherits. Check them against current
spec text before resting a decision on one, because WebGPU has renamed limits.
Everything said about this tree is re-derivable by grep.

## The short answer

- **WebGPU is safe by construction.** The HAL reads every device limit it
  depends on from `device.limits`, and nothing requests a limit above the spec
  floor.
- **WebGL2 rests on convention in one place**: `MAX_CANVAS_DIM_PX` (8192), which
  the spec floor (2048) does not back. ARCHITECTURAL_LIMITS.md owns the entry.
- **The 16-context ceiling is browser policy, not a GPU limit.** It varies by
  browser and version, so no graphics hardware changes it. Only Chrome has been
  measured; the Firefox figure in circulation is a guess, and measuring it with
  the `--tracks` harness in GPU_CONTEXT_BUDGET.md is the cheapest outstanding GPU
  measurement.

## What the code queries

A queried limit cannot be wrong on unseen hardware: the worst case is a smaller
budget and an earlier, legible refusal.

<!-- prettier-ignore -->
| limit | spec floor | where the tree reads it | what happens at the floor |
| --- | --- | --- | --- |
| `maxTextureDimension2D` | 8192 | `webgpuHal.recreateMsaaTexture`, the data-texture path | `OomReporter` shows "zoom in", not a blank canvas |
| `maxBufferSize` | 256 MiB | `webgpuHal` vertex upload guard | same refusal, lower threshold |
| `minUniformBufferOffsetAlignment` | 256 | `WebGPUHal` constructor, ring slot size | nothing; hardware can only beat the default |
| `MAX_TEXTURE_SIZE` (WebGL2) | 2048 | `webgl2Hal`, before `texImage2D` | refuses with the measured max in the message |

`gpuDevice.acquire` requests `maxStorageBufferBindingSize` and `maxBufferSize` at
the adapter's own maxima, so a machine at the floor gets a device at the floor
rather than a failed `requestDevice`.

## What the code assumes

<!-- prettier-ignore -->
| assumption | spec floor | verdict |
| --- | --- | --- |
| `MAX_CANVAS_DIM_PX` (`canvas2dUtils.ts`) | WebGPU 8192, WebGL2 2048 | Equals the WebGPU floor. On WebGL2 it rests on "at least 8192 on essentially all real hardware", which the spec does not guarantee. |
| `MAX_VERTEX_BUFFER_BYTES` (`webgl2Hal.ts`) | not queryable in WebGL2 | Pins WebGPU's spec default because WebGL2 exposes no equivalent. The unguarded alternative is a dropped context. |
| `SampleCount` is `1 \| 4` | 4 is the only multisample count WebGPU permits | The type is the spec, not a choice. |
| 4x MSAA on the preferred canvas format | `maxColorAttachmentBytesPerSample` 32 | One 4-byte attachment. |

ARCHITECTURAL_LIMITS.md calls WebGL2 "the stricter of the two". That holds only
where the adapter reports a large `maxBufferSize`. At the WebGPU floor both
backends refuse at 256 MiB. The guard is safe either way; the asymmetry is
machine-dependent.

## Shader headroom

Re-take these from `**/*.iface.generated.ts` (`awk '/VERTEX_ATTRIBUTES/,/^]/'`)
when a pass grows a dimension:

<!-- prettier-ignore -->
| quantity | floor | widest pass |
| --- | --- | --- |
| vertex attributes in one pass | 16 | alignments' pileup (`read.iface.generated.ts`) |
| vertex buffer stride | 2048 bytes | `wiggleBand.iface.generated.ts` |
| uniform block size | WebGPU 64 KiB binding, WebGL2 16 KiB block | `linkMark.iface.generated.ts` |
| color attachments | 8 | all passes use 1 |

Vertex attributes are the one to watch: the pileup pass has gained attributes
more than once.

## The number that generalizes badly: MSAA target size

ARCHITECTURAL_LIMITS.md gives the formula: canvas area x dpr² x 4 samples x 4
bytes. **dpr enters squared**, so a retina panel costs 4x for the same CSS box.
`getDpr()` caps at `MAX_DPR = 2`, so the factor cannot exceed 4. Each row below
is a single track.

<!-- prettier-ignore -->
| case | device px | MSAA target |
| --- | --- | --- |
| dpr 1, 1266 px window, 4100 px tall (the measured anchor) | 1266 x 4100 | 79.2 MiB |
| 27" retina window (2560 CSS px, dpr 2), height at the clamp | 5120 x 8192 | 640.0 MiB |
| both axes at the clamp, absolute ceiling | 8192 x 8192 | 1024.0 MiB |

The session counts none of this memory. The measured dpr 1 vs dpr 2 comparison:

<!-- BEGIN GENERATED MEASUREMENT msaa-target-dpr -->

_Generated by `pnpm autogen` — edit the source, not this block._

| scenario                              | dpr 1 (MiB) | dpr 2 (MiB) | retina cost |
| ------------------------------------- | ----------- | ----------- | ----------- |
| one alignments track, 1266x840 css    | 16.20       | 64.90       | 4.01x       |
| eight GPU tracks, default heights     | 27.40       | 109.70      | 4.00x       |
| one track dragged to the canvas clamp | 154.50      | 316.50      | 2.05x       |

<!-- END GENERATED MEASUREMENT msaa-target-dpr -->

**These are sizes the descriptors ask for, not necessarily memory held.** The
numbers come from immediate-mode GPUs, where a render attachment is an
allocation. `beginFrame` attaches the MSAA view with `storeOp: 'discard'` and a
`resolveTarget`, which a tiler (Apple Silicon) may keep in tile memory and never
commit. Nobody has profiled that;
[../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md](../ideas/waiting-on-a-number/arc-antialiasing-without-msaa.md)
ranks the residency check first.

**`maxTextureDimension2D` never refuses a clamped canvas.** `syncCanvasSize`
clamps the backing store at `MAX_CANVAS_DIM_PX` before the HAL checks, and a
device whose limit is exactly 8192 never sees an oversize request. `syncCanvasSize`
reports the scale each axis actually got, `hal.resize` returns it, and every
device-px rect derives from that rather than `getDpr()`, so past the clamp a
display draws at reduced resolution. ARCHITECTURAL_LIMITS.md §"A canvas past
`MAX_CANVAS_DIM_PX` renders wrong, not smaller" has the mechanism.

## Other browser-policy limits

- Whether WebGPU is available at all is a browser and driver-allowlist decision.
- Whether `WEBGL_debug_renderer_info` is exposed varies: Firefox with
  `privacy.resistFingerprinting` withholds it, which is why
  `graphicsCapabilities.glRenderer` is optional.

## Finding out what real machines give

`logGpuCapabilities` (`gpuDevice.ts`) `console.warn`s the adapter identity,
`maxTextureDimension2D`, `maxBufferSize` and `maxStorageBufferBindingSize` on
every WebGPU device acquisition, to a console nobody reads.
`graphicsCapabilities.ts` already travels (About widget, stack-trace dialog, one
analytics bit) but reports which GPU, never what it allows.
[../ideas/ready/gpu-limits-in-bug-reports.md](../ideas/ready/gpu-limits-in-bug-reports.md)
parks adding those limits to the stack-trace dialog's capability object.
