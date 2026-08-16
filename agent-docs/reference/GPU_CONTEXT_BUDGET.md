---
name: gpu-context-budget
description: The WebGL2 context ceiling is 16 and what reaches it — the "many-view freeze" and its 2026-06-19 fix, the shapes still exposed (one view with 17 GPU tracks, a multi-panel workspace), the software-rendering cost crossover, the headless/SwiftShader measurement trap, and the harness. Read before touching view windowing or proposing a fix for GPU-context churn.
---

# The WebGL2 context budget

**A page gets 16 live WebGL2 contexts.** The 17th evicts one, `useRenderingBackend`
re-acquires, that eviction evicts another, and the cascade wedges the main thread
rather than degrading. One display owns one context (`WebGL2Hal` takes its own
`getContext('webgl2')`, no pooling), so **contexts are open GPU tracks** and the
budget is a track budget.

Measured 2026-08-05, Chrome 151, by walking `--tracks` up on a single LGV.
Identical on a real Intel UHD 630 and on SwiftShader, so the ceiling is a
browser/ANGLE property rather than a driver one — but what happens *past* it is
not. Contexts created (the +1 is the `getGraphicsCapabilities` probe, which as of
2026-08-12 is only made when WebGPU is *absent* — on a WebGPU machine the
startup path creates none, so re-measuring there gives 16 / 0):

| tracks | real GPU | SwiftShader |
| ------ | -------- | ----------- |
| 16     | 17 / 0 unforced losses | 17 / 0 |
| 17     | 31 / 15  | 26 / 10     |
| 20     | 57 / 41  | 25 / 9      |
| 24     | 73 / 57  | 33 / 9      |

RFC-001 §12b's "Firefox around 16" is the figure that generalizes; its "Chrome
around 8" does not.

## The many-view freeze, and what it left behind

The reported symptom was a many-view session ("can't scroll", which is the
freeze, not a scroll bug) that people attributed to the tiled window manager.
**It was fixed on 2026-06-19** by `perf(views): view-level lazy mount` — 24 views
x 3 tracks put 72 canvases live, and gating each view's body on an
IntersectionObserver took that to 6. That commit already recorded that the freeze
is container-independent (Classic froze identically) and backend-wide (WebGPU
could not mount the canvases at all at scale).

A re-investigation on 2026-08-05 reopened it as a dockview problem and found the
same answer the second time. If it comes up again, the useful questions are
**which build** the report predates and **what the reporter's `chrome://gpu`
says** — not what dockview does differently, which is nothing measurable:
Classic and Tiled scroll within noise of each other on both drivers, and a 2.4x
Tiled reading is what you get from running two modes in one node process.

Three things the lazy mount did **not** fix:

- **One ordinary view with 17 GPU tracks** crosses the ceiling on its own. No
  many-view session, nothing synthetic. Tracks inside a mounted view are not
  virtualized; see TODO.md §"Cut WebGL2 contexts per display".
- **A multi-panel workspace.** The window is per scroll port, so live views scale
  with panels on screen: a 12-view session at 1/2/4 panels holds 6/12/16 live
  canvases. Four panels sits at the ceiling on arrival. This is the one thing
  that is genuinely workspaces-specific, and windowing cannot bound it because
  every panel is on screen.
- **The mount band has no hysteresis**, so every display's pipeline is rebuilt
  once per scroll pass — contexts climb by exactly views x tracks per pass while
  a handful of canvases are live. `VIEW_VISIBILITY_ROOT_MARGIN` is inert and
  making it live is a measured regression; `ViewContainer.tsx` carries the why.

## Cost is the driver's, and the ladder now steps around it

The same session and the same churn, per scroll pass, 12 views x 3 tracks:

| backend  | SwiftShader | real GPU  |
| -------- | ----------- | --------- |
| webgl2   | 9.8-12.0 s  | 1.4-1.5 s |
| canvas2d | 0.21-0.45 s | 1.8-3.2 s |

**Canvas2D is ~25x cheaper than WebGL under software rendering and ~2x more
expensive on a real GPU.** A CPU trace of the SwiftShader case puts 2320 of
4233 ms of busy time in `getShaderParameter` — the COMPILE_STATUS query where
Chrome's async compile lands. Programs are per-context, so each rebuilt context
recompiles the set, and compiling on a CPU rasterizer is what costs.

A user whose Chrome is software-rendering — GPU blocklisted, a VM, remote
desktop, an old driver — used to get the most expensive cell of that table,
because the ladder took WebGL2 whenever a context could be created. The ladder
was the thing that had to change; `effectiveRenderer` only names the rung it
lands on, and an earlier version of this paragraph blamed that reporting
function, which would have sent someone to patch a string.

### The churn number is not the reason — the floor is

The 25x above is a churn workload, and churn was the wrong thing to build the
case on: it repays a per-context shader compile over and over, so it flatters
the argument in a way an ordinary session would not reproduce. **One view with
three tracks and no churn at all** — the SCROLL passes measure zero long tasks,
because a single view never leaves the mount band — measured headless (which is
SwiftShader), three runs per arm, 2026-08-12:

| arm      | long tasks, total | worst single task | tasks over 500 ms |
| -------- | ----------------- | ----------------- | ----------------- |
| webgl2   | 2.1 / 8.8 / 2.1 s | 1.3 / 5.5 / 1.3 s | 1 / 2 / 1         |
| canvas2d | 0.69 / 1.4 / 0.95 s | 0.15 / 0.34 / 0.22 s | 0 / 0 / 0     |

So the crossover holds far below the pathological case, the WebGL arm is wildly
variable while the Canvas2D arm is not, and the cost is **the load-time pipeline
build**, not the per-pass rebuild the churn number attributes it to. `over500`
is the cleanest line to read: one or two per load on WebGL2, never once on
Canvas2D. Reproduce with
`node browser-tests/workspaces-freeze-stress.ts --views=1 --tracks=3 --mode=classic`,
which reports LOAD separately from the scroll passes.

**`createGpuHal` therefore steps over the WebGL2 rung when the rasterizer is
software and nothing was pinned**, falling to Canvas2D exactly as it does on a
machine with no WebGL2 at all. It is not a `setGpuOverride` — that field means "a
human asked for this", and spending it here would leave nothing able to tell an
app decision from a user's, including the About widget and the bug report the
user is about to send.

**How it sees it.** The probe reads `WEBGL_debug_renderer_info` /
`UNMASKED_RENDERER_WEBGL` off the context it already creates — free, and only on
the no-WebGPU population, which is the only one whose rasterizer matters.
`GraphicsCapabilities.glRenderer` carries the driver string and `softwareWebgl`
the verdict. That verdict is `undefined`, not `false`, where the browser
withholds the extension (Firefox under `privacy.resistFingerprinting`), and the
ladder treats undefined as "keep WebGL2" — an unrecognized rasterizer must never
read as a software one. The string stays local to the stack-trace dialog, like
`gpuVendor`; analytics gets the coarse `software-rendering` bit.

**Two things the check must not break, both of which render on SwiftShader.**

- **The cross-backend gate.** CI passes `--swiftshader` and headless Chrome picks
  it anyway (see the table in CROSS_BACKEND_GATE.md), so a rasterizer check that
  ignored the `?renderer=` pin would turn the gate's webgl side into a second
  canvas2d render, and 66 pairs would agree perfectly while proving nothing. The
  pin wins for exactly this reason, `appendGpuParam` sets it on every GPU arm,
  and `createRenderingBackend.test.ts` pins the property directly.
- **The figure corpus.** Every capture runs headless and pinned nothing, so a
  regen would have silently redrawn every figure on Canvas2D — a whole-corpus
  visual change arriving as a side effect. `pinRenderer` in
  `website/scripts/screenshot-ready.ts` is the one place to change if the corpus
  should ever move backends deliberately; `captureUrl` and `snapshot.ts` both
  apply it, and the embedded harness sets the same pin through the product's
  `setGpuOverride` export, having no url of ours to put a parameter in.

  **Two attempts got this wrong before it was right, in opposite directions.**
  Pinning inside `sessionSpec` looked like the tidy single place — but that
  builder feeds `gen-gallery-links.ts` as well as the captures, so it forced
  WebGL on 251 website gallery links, i.e. on exactly the visitors this whole
  section is about. Moving the pin to `snapshot.ts::captureToTemp` then missed
  the corpus entirely, because `generate-screenshots.ts` navigates through
  `captureUrl` instead. If you touch this, enumerate the navigation paths first:
  `renderSpecToTemp` branches to the embedded harness or `captureUrl`, and
  `captureEachStage` re-enters `captureUrl` per stage.

**The pin is already the protection, and it is already in place.**
`runWithRenderingBackend` sets `snapshotConfig.backend` for every run (it
defaults to `canvas2d`, so it is never unset), and `helpers.ts` builds every test
url through `appendGpuParam`, which appends `renderer=<backend>`. So the suite is
pinned end to end, and the routing only has to honor a pin the way `createGpuHal`
already honors one — "a pin is not a preference" is that file's existing
doctrine. What is *not* pinned is the standalone scripts that build their own
urls, and most of those pass `renderer=` explicitly too.

This paragraph first claimed the opposite — that the suite was unpinned and had
to be pinned before the ladder could change. It was written from
`appendGpuParam`'s early return without checking who sets `snapshotConfig.backend`,
which is every run. The prerequisite for routing is the analytics number, not a
test-harness change.

Measured on this box the same day, loading jbrowse-web with real tracks and
reading the string the detection reads:

| launch | UNMASKED_RENDERER_WEBGL | `softwareWebgl` |
| --- | --- | --- |
| headed | `ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL ES 3.2)` | false |
| headless | `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) …), SwiftShader driver)` | true |

Both runs logged **zero** context-lost lines, which is the probe's `loseContext()`
removal confirmed in a browser rather than in jsdom. Neither run had WebGPU —
Chrome 151 here reports no compatible adapter — so the WebGPU-skips-the-probe
path is still pinned only by unit tests, and a dev box on this hardware is in the
population that keeps probing.

## Chrome is not the only browser on the box

**That last paragraph is about Chrome, and it has already been misread as "this
machine cannot run WebGPU at all."** It can. `runner.ts` routes every
`--backend=webgpu` run through Firefox Nightly precisely because Chrome +
puppeteer does not render WebGPU canvases, and Firefox Nightly on this same
Intel UHD 630 acquires a device and renders:

```
[GPU] WebGPU device ready — maxTextureDimension2D=8192 maxBufferSize=1073741824
```

So a claim of the form "we have no way to check the WebGPU path here" is wrong,
and it has been written into this doc set once. `node
browser-tests/runner.ts --backend=webgpu --filter=<suite>` is the check; it runs
headed, and `--backend=all --gate-only` adds the canvas2d-vs-webgpu drift
comparison, which needs no golden. Note `maxBufferSize` is the **adapter's**
maximum rather than the 256 MiB spec default, because `gpuDevice.acquire` asks
for `adapter.limits.maxBufferSize` — so the number a guard trips on is
machine-specific, and reading one off this table is not reading the spec.

## The probe's own context

`getGraphicsCapabilities` is memoized per page and holds its probe context until
GC rather than releasing it with `WEBGL_lose_context.loseContext()`. That call
was removed on 2026-08-12 for the reason ADR-005 removed it from
`WebGL2Hal.dispose()` — it is effectively driver-wide on Firefox, so probing
while tracks were on screen knocked out their live contexts — and because both
browsers log the loss to the console, which users read as a fault.

The held context cannot start the cascade above: it is the oldest, so it is the
first thing an over-ceiling page evicts, and nothing draws to it or re-acquires
it. Before the memo, each reopening of the About widget or the stack-trace dialog
made another one.

**Eviction is strictly oldest-first, measured** (2026-08-12, Chrome 151 headless,
a bare page that makes 24 one-pixel WebGL2 contexts and holds a reference to
every one, so nothing is collectable): all 24 are created, then indices 0-7 —
exactly the eight oldest — report `webglcontextlost` and answer
`isContextLost()`, leaving 16 alive. That is the ceiling and the victim order in
one run, and it is what makes leaving the probe's context alive safe rather than
merely cheap. It is a Blink property, not a driver one, so the SwiftShader
launch does not weaken it.

## Measuring it: pass `--headed=true`

`products/jbrowse-web/browser-tests/workspaces-freeze-stress.ts` (build first).
Real tracks are required — an earlier harness used empty views and came back
clean.

```
node browser-tests/workspaces-freeze-stress.ts --views=1 --tracks=17 --headed=true
node browser-tests/workspaces-freeze-stress.ts --mode=classic,tiled --headed=true
node browser-tests/workspaces-freeze-stress.ts --mode=tiled --panels=4 --headed=true
```

**Headless Chrome renders WebGL on SwiftShader**, confirmed here via
`UNMASKED_RENDERER_WEBGL` (`SwiftShader driver` headless, `Mesa Intel(R) UHD
Graphics 630` headed). The two differ by ~10x on exactly this cost, so a headless
run measures software rendering, not what a user sees. This has now produced one
wrong conclusion (a "10-second scroll freeze" that is 1.4 s on hardware) and cost
a re-measure; the same warning is in
[TEST_INFRASTRUCTURE.md](TEST_INFRASTRUCTURE.md).

## Fixes measured and eliminated

Nothing that redistributes *when* a pipeline is built helps. Both ends are
expensive: building one costs a context and a shader recompile, holding one costs
against the ceiling.

- **MST write amplification through dockview's layout echo.** The sync autorun
  observes `init`, `dockviewLayout`, `views`, `panelViewAssignments` and
  `activePanelId`; none change while scrolling or panning, so reconcile does not
  run per interaction. The canvas2d control settles it independently — same
  session, same writes, a fraction of the cost.
- **Releasing the context on dispose** (gating `WEBGL_lose_context.loseContext()`
  on non-Firefox in `webgl2Hal.dispose`). Contexts created unchanged, long tasks
  the same or worse. The cost is acquiring contexts, not holding them.
- **Dropping the eager COMPILE_STATUS / LINK_STATUS queries.** No better than
  baseline — remove them and the driver blocks at link or first draw instead.
- **Giving the mount band real hysteresis** (rooting the observer at the scroll
  port so `rootMargin` applies at all). Restores the band, comes out a wash on
  scroll cost, and roughly doubles live contexts — which is the wrong side of a
  ceiling of 16.

What is left is structural: pool contexts, share one across displays (one canvas,
scissored draws), or WebGPU, which shares a device and has no per-canvas cap.
Track-level mount/release is the cheap version and the ceiling says it is worth
building.

Related: [ARCHITECTURAL_LIMITS.md](ARCHITECTURAL_LIMITS.md) §"One WebGL2 context
per display canvas", [GPU_RENDERING.md](GPU_RENDERING.md),
[ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).
