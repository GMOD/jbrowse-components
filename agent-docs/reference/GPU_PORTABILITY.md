---
name: gpu-portability
description: What does a GPU guarantee beyond the one laptop we measured — queried and hardcoded limits, shader headroom over the spec floor, MSAA target size, and the 16-context WebGL2 ceiling with what reaches it and how to measure it?
kind: spec
---

# GPU portability: what is guaranteed, and what is one laptop

Every GPU number this repo records comes from one integrated-GPU machine.
[ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) says so in each entry's
provenance line. This doc answers the other question, **what is true on hardware
we have never seen?**, by comparing the published spec minimums against what the
tree queries or bakes in; none of that needs hardware. The last half covers the
one limit that is browser policy rather than hardware, the WebGL2 context
ceiling, and what reaches it.

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
  the `--tracks` harness (§"Measuring it" below) is the cheapest outstanding GPU
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
clamps the backing store at `MAX_CANVAS_DIM_PX` before the HAL checks, so a
device whose limit is exactly 8192 never sees an oversize request and a display
past the clamp draws at reduced resolution. ARCHITECTURAL_LIMITS.md §"A canvas
past `MAX_CANVAS_DIM_PX` renders wrong, not smaller" has the mechanism.

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

## The WebGL2 context budget

**A page gets 16 live WebGL2 contexts.** The 17th evicts one,
`useRenderingBackend` re-acquires, that eviction evicts another, and the cascade
wedges the main thread rather than degrading. One display owns one context
(`WebGL2Hal` takes its own `getContext('webgl2')`, no pooling), so the budget is
a budget of open GPU tracks.

Walking `--tracks` up on one LGV (Chrome, contexts created / unforced losses;
the +1 is the `getGraphicsCapabilities` probe, made only when WebGPU is absent):

| tracks | real GPU | SwiftShader |
| ------ | -------- | ----------- |
| 16     | 17 / 0   | 17 / 0      |
| 17     | 31 / 15  | 26 / 10     |
| 20     | 57 / 41  | 25 / 9      |
| 24     | 73 / 57  | 33 / 9      |

The ceiling is identical on both, so it is a browser property; what happens past
it is not.

### The many-view freeze, and what it left behind

The many-view freeze ("can't scroll") was fixed by view-level lazy mount
(`useViewVisibility.ts`): each view's body mounts only while an
IntersectionObserver says it is on screen. The freeze is container-independent
and backend-wide. If it is reported again, ask which build the report predates
and what the reporter's `chrome://gpu` says.

Three shapes the lazy mount does not bound:

- **One view with 17 GPU tracks** crosses the ceiling alone. Tracks inside a
  mounted view are not virtualized; see
  [Cut WebGL2 contexts per display](../ideas/waiting-on-someone-else/cut-webgl2-contexts-per-display.md).
- **A multi-panel workspace.** The window is per scroll port, so live views scale
  with panels on screen; four panels sit at the ceiling on arrival, and
  windowing cannot help when every panel is visible.
- **The mount band has no hysteresis**, so every display's pipeline rebuilds
  once per scroll pass. `useViewVisibility.ts` carries why that is deliberate.

### Software rendering: Canvas2D wins, and the ladder steps around WebGL2

Per scroll pass, 12 views × 3 tracks:

| backend  | SwiftShader | real GPU  |
| -------- | ----------- | --------- |
| webgl2   | 9.8-12.0 s  | 1.4-1.5 s |
| canvas2d | 0.21-0.45 s | 1.8-3.2 s |

Canvas2D is ~25x cheaper than WebGL under software rendering and ~2x dearer on
a real GPU. The cost is shader compilation (`getShaderParameter` for
COMPILE_STATUS dominates a CPU trace): programs are per-context, and compiling on
a CPU rasterizer is slow. Churn flatters that ratio, but the crossover holds with
no churn at all — one view, three tracks, where the load-time pipeline build
alone produces multi-second tasks on WebGL2 and none over 500 ms on Canvas2D
(`node browser-tests/workspaces-freeze-stress.ts --views=1 --tracks=3 --mode=classic`).

So `createGpuHal` steps over the WebGL2 rung when the rasterizer is software and
nothing was pinned; the comment there has the numbers. It is not a
`setGpuOverride`, which means "a human asked for this" — spending it on an app
decision would leave the About widget and bug reports unable to tell the two
apart.

The probe reads `UNMASKED_RENDERER_WEBGL` off the context it already makes, into
`GraphicsCapabilities.glRenderer` and `softwareWebgl`. **`softwareWebgl` is
`undefined`, not `false`, where the browser withholds the extension** (Firefox
under `resistFingerprinting`), and undefined keeps WebGL2 — an unrecognized
rasterizer must never read as software. Analytics gets only the coarse
`software-rendering` bit.

**A pin always wins, because two consumers render on SwiftShader:**

- **The cross-backend gate.** Headless Chrome is SwiftShader with or without
  `--swiftshader` (see the table in
  [CROSS_BACKEND_GATE.md](CROSS_BACKEND_GATE.md)), so an unpinned gate would
  compare canvas2d with canvas2d and pass. `appendGpuParam` sets `renderer=` on
  every run from `snapshotConfig.backend`, and
  `createRenderingBackend.test.ts` pins the property.
- **The figure corpus.** `pinRenderer` in `website/scripts/screenshot-ready.ts`
  is the one place to move it between backends. Pinning in `sessionSpec` instead
  forces WebGL on the website's gallery links (`gen-live-links.ts` reads the same
  builder), and pinning in `snapshot.ts::captureToTemp` misses the corpus. Before
  touching it, enumerate the navigation paths: `renderSpecToTemp` branches to the
  embedded harness (pinned through `setGpuOverride`) or `captureUrl`, and
  `captureEachStage` re-enters `captureUrl` per stage.

### WebGPU on a box whose Chrome has none

Chrome + puppeteer does not render WebGPU canvases, so
`browser-tests/runner.ts` sends `--backend=webgpu` through Firefox Nightly, which
acquires a device on the same integrated GPU. "We cannot check the WebGPU path
here" is wrong: `node browser-tests/runner.ts --backend=webgpu --filter=<suite>`
is the check, and `--backend=all --gate-only` adds the drift comparison.
The logged `maxBufferSize` is the adapter's, not the spec default (see "What the
code queries"), and moves with driver and browser version.

Past the ceiling a scroll-zoom on WebGL2 spends much of its main thread on
context recovery; WebGPU shares one device across canvases and paces 28 tracks
like 8. Two traps when re-measuring headed in Firefox: under Wayland it stops
`requestAnimationFrame` for a window the compositor deems hidden, so launch with
`MOZ_ENABLE_WAYLAND=0 GDK_BACKEND=x11`; and real pointer events on a desktop in
use flip the wheel controller's pointer-presence gate.

### The probe's own context

`getGraphicsCapabilities` is memoized per page and holds its probe context until
GC instead of calling `WEBGL_lose_context.loseContext()`, which ADR-005 removed
from `WebGL2Hal.dispose()` for the same reason: on Firefox it is effectively
driver-wide, and both browsers log the loss where users read it as a fault.

The held context cannot start the cascade. **Eviction is strictly
oldest-first** — a page holding 24 contexts loses exactly indices 0-7 — so the
probe's context is the first one evicted, and nothing draws to or re-acquires
it. That is a Blink property, so the SwiftShader measurement holds.

### Measuring it: pass `--headed=true`

`products/jbrowse-web/browser-tests/workspaces-freeze-stress.ts`, after a build.
Real tracks are required; empty views come back clean.

```
node browser-tests/workspaces-freeze-stress.ts --views=1 --tracks=17 --headed=true
node browser-tests/workspaces-freeze-stress.ts --mode=classic --headed=true
node browser-tests/workspaces-freeze-stress.ts --mode=tiled --panels=4 --headed=true
```

**Headless Chrome renders WebGL on SwiftShader**, ~10x slower on exactly this
cost, so a headless run measures software rendering, not what a user sees. The
same warning is in [TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md). Compare modes in separate processes; the harness header says why.

### Fixes measured and eliminated

Redistributing when a pipeline is built does not help: building one costs a
context and a shader recompile, holding one costs against the ceiling.

- **Layout write amplification** (the dockview echo, gone with ADR-068). The
  Canvas2D control with the same writes costs a fraction, so writes were not it.
- **Releasing the context on dispose** (`loseContext()` in `webgl2Hal.dispose`):
  contexts created unchanged, long tasks the same or worse. Acquiring costs, not
  holding.
- **Dropping the eager COMPILE_STATUS / LINK_STATUS queries**: the driver blocks
  at link or first draw instead.
- **Hysteresis on the mount band** (rooting the observer at the scroll port so
  `rootMargin` applies): a wash on scroll cost, roughly double the live
  contexts.

What remains is structural: pool contexts, share one across displays (one
canvas, scissored draws), or WebGPU. Track-level mount/release is the cheap
version, and the ceiling says it is worth building.

Related: [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"One WebGL2 context
per display canvas", [GPU_HAL.md](GPU_HAL.md) §"WebGL2 contexts are a page-level budget",
[ADR-068](../architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md).
