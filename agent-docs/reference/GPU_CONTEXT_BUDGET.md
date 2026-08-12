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

## Cost is the driver's, and the app cannot see which driver it has

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

`preferredRenderer` returns WebGL2 whenever a context exists
(`getGraphicsCapabilities` reports `webgl2: !!gl`), so a user whose Chrome is
software-rendering — GPU blocklisted, a VM, remote desktop, an old driver — gets
the most expensive cell of that table. The probe still creates a context on
exactly that population (no WebGPU is what makes it probe at all), so reading
`WEBGL_debug_renderer_info` / `UNMASKED_RENDERER_WEBGL` off it is free.

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
