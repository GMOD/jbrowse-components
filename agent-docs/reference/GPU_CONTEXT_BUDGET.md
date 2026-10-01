---
name: gpu-context-budget
description: The WebGL2 context ceiling is 16 and what reaches it — the many-view freeze, the shapes still exposed, the software-rendering crossover, and the headless measurement trap. Read before touching view windowing or GPU-context churn.
kind: measurement
---

# The WebGL2 context budget

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
it is not. RFC-001 §12b's "Chrome around 8" is wrong.

## The many-view freeze, and what it left behind

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

## Software rendering: Canvas2D wins, and the ladder steps around WebGL2

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

## WebGPU on a box whose Chrome has none

Chrome + puppeteer does not render WebGPU canvases, so
`browser-tests/runner.ts` sends `--backend=webgpu` through Firefox Nightly, which
acquires a device on the same integrated GPU. "We cannot check the WebGPU path
here" is wrong: `node browser-tests/runner.ts --backend=webgpu --filter=<suite>`
is the check, and `--backend=all --gate-only` adds the drift comparison.
`gpuDevice.acquire` requests `adapter.limits.maxBufferSize`, so the logged
`maxBufferSize` is the adapter's and moves with driver and browser version, not
the spec default.

Past the ceiling a scroll-zoom on WebGL2 spends much of its main thread on
context recovery; WebGPU shares one device across canvases and paces 28 tracks
like 8. Two traps when re-measuring headed in Firefox: under Wayland it stops
`requestAnimationFrame` for a window the compositor deems hidden, so launch with
`MOZ_ENABLE_WAYLAND=0 GDK_BACKEND=x11`; and real pointer events on a desktop in
use flip the wheel controller's pointer-presence gate.

## The probe's own context

`getGraphicsCapabilities` is memoized per page and holds its probe context until
GC instead of calling `WEBGL_lose_context.loseContext()`, which ADR-005 removed
from `WebGL2Hal.dispose()` for the same reason: on Firefox it is effectively
driver-wide, and both browsers log the loss where users read it as a fault.

The held context cannot start the cascade. **Eviction is strictly
oldest-first** — a page holding 24 contexts loses exactly indices 0-7 — so the
probe's context is the first one evicted, and nothing draws to or re-acquires
it. That is a Blink property, so the SwiftShader measurement holds.

## Measuring it: pass `--headed=true`

`products/jbrowse-web/browser-tests/workspaces-freeze-stress.ts`, after a build.
Real tracks are required; empty views come back clean.

```
node browser-tests/workspaces-freeze-stress.ts --views=1 --tracks=17 --headed=true
node browser-tests/workspaces-freeze-stress.ts --mode=classic --headed=true
node browser-tests/workspaces-freeze-stress.ts --mode=tiled --panels=4 --headed=true
```

**Headless Chrome renders WebGL on SwiftShader**, ~10x slower on exactly this
cost, so a headless run measures software rendering, not what a user sees. The
same warning is in [TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md).Compare modes in separate processes; the harness header says why.

## Fixes measured and eliminated

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
per display canvas", [GPU_RENDERING.md](GPU_RENDERING.md),
[ADR-068](../architecture-decision-records/adr-068-workspace-layout-is-an-mst-tree.md).
