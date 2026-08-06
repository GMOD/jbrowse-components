---
name: workspaces-freeze
description: Many-view freeze — measured 2026-08-05 as driver-dependent, not workspaces; Classic and Tiled are identical, the GPU context ceiling is 16, and the wedge only reproduces under software rendering, where Canvas2D is 25x cheaper than WebGL
---

# The many-view freeze

A reporter's many-view session (strains) locks up with `useWorkspaces` on. "Can't
scroll" is the symptom people report; it is the freeze, not a scroll bug
(`JBrowseViewPanel` already has `overflowY: auto`).

**Keep dockview.** See
[ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).

Reproduce with
`products/jbrowse-web/browser-tests/workspaces-freeze-stress.ts` (build first).
It needs **real tracks** — the first harness used empty views, which is why it
came back clean.

## Read this before trusting any number here

**Headless Chrome renders WebGL on SwiftShader on this machine**, confirmed via
`UNMASKED_RENDERER_WEBGL`: headless reports `SwiftShader driver`, headed reports
`Mesa Intel(R) UHD Graphics 630`. The two differ by ~10x on exactly the cost this
thread is about, so a headless measurement of it is not a measurement of what a
user sees. **Pass `--headed=true`.** Every number below says which it is.

This bit an earlier pass of this very investigation, which reported a 10-second
scroll freeze that is a SwiftShader artifact.

## Established — do not re-derive

12 views x 3 volvox tracks, 1400x900, one full scroll pass per "pass".

- **It is not workspaces.** Classic and Tiled are indistinguishable on both
  drivers. Headed: Classic load 1.5 s / scroll 1.0, 1.2 s; Tiled load 2.1 s /
  scroll 1.5, 1.4 s. Headless: five paired runs, Classic 10.6/11.4/10.0/9.7/10.7
  s against Tiled 10.2/8.7/9.8/8.7 s.
- **A 2.4x Tiled result is an artifact of sharing one node process.** The first
  pairing put Tiled at 25.9 s in second position; `classic,classic` in one
  process reproduces no such penalty. Compare modes across processes only.
- **The window has no hysteresis, so every display's GPU pipeline is rebuilt
  once per scroll pass.** Contexts created climb +36 a pass (31 -> 61 -> 97 ->
  133) — exactly views x tracks — while at most 3-6 canvases are live. This is
  byte-identical headed and headless: the churn is app behavior, not driver.
- **The main-thread cost of that churn is almost entirely the driver's.** Same
  session, same churn, per scroll pass:

  | backend  | SwiftShader (headless) | real GPU (headed) |
  | -------- | ---------------------- | ----------------- |
  | webgl2   | 9.8 - 12.0 s           | 1.4 - 1.5 s       |
  | canvas2d | 0.21 - 0.45 s          | 1.8 - 3.2 s       |

  Note the crossover: **Canvas2D is ~25x cheaper than WebGL under software
  rendering and ~2x more expensive on a real GPU.** A CPU trace of the
  SwiftShader case puts 2320 of 4233 ms of busy time in `getShaderParameter`,
  the COMPILE_STATUS query where Chrome's async compile lands — programs are
  per-context, so each rebuilt context recompiles the set, and compiling on a CPU
  rasterizer is what costs.
- **No wedge reproduces on real hardware with volvox.** Every shape tried stays
  under 2.6 s at load and 1.5 s per scroll pass headed. The freeze is real, but
  this harness only produces it under software rendering.

### The context ceiling is 16, and one ordinary view reaches it

Answers what TODO.md §"Cut WebGL2 contexts per display" used to ask for. One
LGV, walking `--tracks` up, contexts created (the +1 is the
`getGraphicsCapabilities` probe, which is also the `lost=1`):

| tracks | headed contexts / losses | headless contexts / losses |
| ------ | ------------------------ | -------------------------- |
| 16     | 17 / 1                   | 17 / 1                     |
| 17     | 31 / 15                  | 25-26 / 9-10               |
| 20     | 57 / 41                  | 25 / 9                     |
| 24     | 73 / 57                  | 33 / 9                     |

**16 live contexts is the ceiling on both drivers**, reproducible across repeats,
and the 17th evicts. So the ceiling is a browser/ANGLE property, while the
*cascade past it* is far more violent on the real GPU. This retires the old
"bracketed between 20 and 72" reading, and it lands on RFC-001 §12b's Firefox
figure rather than its Chrome one.

That threshold is reachable by a single ordinary view — 17 GPU tracks — with no
workspace, no many-view session, and nothing synthetic about it.

### What workspaces contributes: panel count, and only that

The window is per scroll port, so live views scale with panels on screen.
Classic is one column and stays bounded; a grid is not. Same 12-view session at
load, headless: 1/2/4 panels -> 6/12/16 live canvases, 31/49/61 contexts,
15/33/45 losses. Headed at 4 panels: 16 canvases, 85 contexts, 69 losses.
A 4-panel workspace sits at the ceiling on arrival.

## Disproven fixes — measured, don't retry

- **MST write amplification through the layout echo.** The previous suspect. The
  sync autorun observes `init`, `dockviewLayout`, `views`, `panelViewAssignments`
  and `activePanelId`; none change while scrolling or panning, so reconcile does
  not run per interaction at all. The canvas2d control settles it independently:
  same session, same writes, a fraction of the cost.
- **Releasing the context on dispose** (gating `WEBGL_lose_context.loseContext()`
  on non-Firefox in `webgl2Hal.dispose`). Contexts created unchanged
  (31/61/97/133), long tasks the same or worse. The cost is in *acquiring*
  contexts, not holding them.
- **Dropping the eager COMPILE_STATUS / LINK_STATUS queries.** No better than
  baseline. `getShaderParameter` is where the wait *surfaces*, not an avoidable
  call — remove it and the driver blocks at link or first draw instead.
- **Giving the mount band real hysteresis.** `VIEW_VISIBILITY_ROOT_MARGIN` is
  inert: an observer clips the target against each scrolling ancestor *before*
  applying the margin, which expands only the root box, and both view containers
  are `overflow-y: auto`. Measured through a nested scroller, `150% 0px`
  qualifies exactly the items a `0px` margin would. Rooting the observer at the
  scroll port (`scrollPortOf`) restores the band — live canvases 6 -> 9-13 — and
  on a reading-style scroll (`--pattern=jitter`) came out a wash headless
  (19.6/15.8/10.8 s against a baseline 11.6/15.4/14.5 s) while creating *more*
  contexts per pass. Headed it can only be worse: the rebuild it saves is the
  cheap half on a real GPU, while the extra live contexts push toward a ceiling
  whose cascade is the violent half. Reverted; both call sites say so.
- **View-stack windowing** was disproven earlier as a Tiled/Classic
  differentiator, and remains so: `ClassicViewsContainer` renders the same
  `ViewStack` over `session.views` entire.

## Where to go next

**1. Detect the software rasterizer and prefer Canvas2D on it.** The strongest
lead, and cheap. `getGraphicsCapabilities` returns `webgl2: !!gl` and
`preferredRenderer` takes WebGL2 whenever a context exists, so a user whose
Chrome is software-rendering — GPU blocklisted, a VM, remote desktop, an old
driver — gets the one combination the table above says is 25x the cost. That
also fits the report better than anything else here: Classic and Tiled are
identical on this machine, and the reporter sees a difference, so something about
their environment is not this machine. The probe already creates a context, so
`WEBGL_debug_renderer_info` / `UNMASKED_RENDERER_WEBGL` is free to read. **Ask
the reporter for their `chrome://gpu` before building it** — one line of
confirmation beats the inference.

**2. Cut contexts per display**, since 16 is the ceiling and one view with 17
tracks crosses it: pool contexts, or share one across displays (one canvas,
scissored draws), or WebGPU, which shares a device and has no per-canvas cap.
Track-level mount/release is the cheaper version and the ceiling now says it is
worth building.

Nothing that redistributes *when* a pipeline is built helps — that is what the
four disproven fixes have in common. Both ends are expensive: building one costs
a context and a shader recompile, holding one costs against the cap.

Related: [ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md),
[ARCHITECTURAL_LIMITS](../reference/ARCHITECTURAL_LIMITS.md),
[app-core/CLAUDE.md](../../packages/app-core/CLAUDE.md).
