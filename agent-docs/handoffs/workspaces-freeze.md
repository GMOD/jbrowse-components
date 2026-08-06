---
name: workspaces-freeze
description: Many-view sessions freeze on a GPU backend; measured 2026-08-05 as per-remount shader recompilation, not dockview and not MST write amplification — Classic and Tiled are indistinguishable at one panel, and panel count is the only workspaces-specific amplifier
---

# The many-view freeze

A reporter's many-view session (strains) locks up with `useWorkspaces` on. "Can't
scroll" is the symptom people report; it is the freeze, not a scroll bug
(`JBrowseViewPanel` already has `overflowY: auto`).

**Keep dockview.** See
[ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md).

Reproduce with
`products/jbrowse-web/browser-tests/workspaces-freeze-stress.ts` (build first).
It needs **real tracks on a GPU backend** — the first harness used empty views on
canvas2d, which is why it came back clean.

## Measured 2026-08-05 — do not re-derive

12 views x 3 volvox tracks, 1400x900, real GPU, one full scroll pass per
"pass". Context counts are deterministic to the integer across every run.

- **It reproduces, and it is not workspaces.** Five paired runs, each mode in its
  own process: Classic scroll 10.6 / 11.4 / 10.0 / 9.7 / 10.7 s of long tasks,
  Tiled 10.2 / 8.7 / 9.8 / 8.7 s. Indistinguishable. Load is likewise identical
  (~2.8 s, 31 contexts, 15 losses in **both** modes).
- **A 2.4x Tiled result is an artifact of sharing one node process.** The first
  pairing measured Tiled at 25.9 s in second position; `classic,classic` in one
  process reproduces no such penalty (10.0 then 9.7 s) and `tiled,tiled` gives
  8.7/9.8 s. Compare modes across processes only.
- **The cost is one full GPU-pipeline rebuild per display per scroll pass.**
  Contexts created climb +36 per pass (31 -> 61 -> 97 -> 133) — exactly
  views x tracks — while at most 3-6 canvases are ever live, because
  `useViewVisibility` unmounts a view's body when it scrolls out and remounts it
  on the way back, and each remount takes a **fresh WebGL2 context**.
- **It is shader compilation.** A CPU trace over one scroll pass
  (`analyze-trace.ts`) attributes 2320 ms of 4233 ms main-thread busy time to
  `getShaderParameter` — the synchronous COMPILE_STATUS query in
  `webgl2Hal.ts:createShader`, where Chrome's async compile lands. Programs are
  per-context, so every fresh context recompiles the whole set.
- **Canvas2D is the control and it is clean.** Identical mount/unmount churn (2D
  contexts also climb +36 a pass), 208-452 ms of long tasks per pass against
  9800-11100 ms on webgl, p95 frame 17 ms. So React, MST, dockview and the
  windowing are all exonerated: the delta is entirely the GPU pipeline rebuild.
- **The context-loss cascade is real but secondary.** At 3 tracks it runs hot (45
  losses a pass, 0 browser restorations ever). At 1 track it never triggers
  (losses stay at 1) and a scroll pass *still* costs 7.3-9.1 s.

### The one thing that IS workspaces-specific: panel count

`useViewVisibility` windows each panel's stack against the viewport, so live
views scale with the number of panels on screen. Classic is one column and is
always bounded to ~2-3; a grid is not. Same 12-view session, at load, no
scrolling:

| panels | live canvases | contexts | losses | long tasks |
| ------ | ------------- | -------- | ------ | ---------- |
| 1      | 6             | 31       | 15     | 2.8 s      |
| 2      | 12            | 49       | 33     | 6.5 s      |
| 4      | 16            | 61       | 45     | 11.2 s     |

A 4-panel workspace wedges the main thread for 11 s on load alone. If the
reporter's session splits across panels, this is the Tiled-only difference they
are seeing — and windowing cannot bound it, because every panel is on screen.

## Disproven fixes — measured, don't retry

- **MST write amplification through the layout echo.** The previous suspect. The
  sync autorun observes `init`, `dockviewLayout`, `views`, `panelViewAssignments`
  and `activePanelId`; none change while scrolling or panning, so reconcile does
  not run per interaction at all. The canvas2d control settles it independently:
  same session, same writes, 2% of the cost.
- **Releasing the context on dispose** (gating `WEBGL_lose_context.loseContext()`
  on non-Firefox in `webgl2Hal.dispose`). Contexts created were unchanged
  (31/61/97/133) and long tasks the same or worse. The cost is in *acquiring*
  contexts, not in holding them.
- **Dropping the eager COMPILE_STATUS / LINK_STATUS queries.** 11.8/15.9 s a
  pass, no better than baseline. `getShaderParameter` is where the wait
  *surfaces*, not an avoidable API call — remove it and the driver blocks at
  link or first draw instead.
- **Giving the mount band real hysteresis.** `VIEW_VISIBILITY_ROOT_MARGIN` is
  inert: an observer clips the target against each scrolling ancestor *before*
  applying the margin, which expands only the root box, and both view containers
  are `overflow-y: auto`. Measured through a nested scroller, `150% 0px`
  qualifies exactly the items a `0px` margin would. Rooting the observer at the
  scroll port (`scrollPortOf`) does restore the band — live canvases 6 -> 9-13 —
  and on a reading-style scroll (`--pattern=jitter`) it comes out **a wash**:
  19.6/15.8/10.8 s against a baseline 11.6/15.4/14.5 s, while *creating more*
  contexts per pass (66/57/33 vs 33/39/39) and triggering browser restorations
  for the first time. The band trades pipeline rebuilds for live contexts, and
  the cap is the tighter constraint. Reverted; both call sites now say so.
- **View-stack windowing** was disproven earlier as a Tiled/Classic
  differentiator, and remains so: `ClassicViewsContainer` renders the same
  `ViewStack` over `session.views` entire.

The shape of all four: nothing that redistributes *when* a display's GPU
pipeline is built helps, because both ends are expensive — building one costs a
context and a shader recompile, and holding one costs against the cap. Only
cutting contexts per display moves the floor.

## Where to go next

Every cheap fix is gone; what is left is structural, and all of it is "stop
building a per-display GPU pipeline over and over":

1. **Don't dispose the backend when a view scrolls out of view.** Kills the
   per-pass rebuild outright, but re-exposes the context cap
   ([ARCHITECTURAL_LIMITS](../reference/ARCHITECTURAL_LIMITS.md), "One WebGL2
   context per display canvas") — so it needs a global LRU budget over live
   backends rather than a per-view visibility decision.
2. **Share one WebGL2 context across displays** (pool, or one canvas with
   scissored draws). Compiles the program set once for the page.
3. **WebGPU**, which shares one device across displays and has no per-canvas cap
   — already the stated direction for the same reason.

Note (1) and the panel-count table point at the same missing thing: a *global*
budget for live GPU displays. `useViewVisibility` is a per-view proxy for one,
and the panel grid is where the proxy breaks. But a budget alone only chooses
*which* displays pay the rebuild — the mount-band result above is what says a
policy change cannot be the whole fix. Pair it with (2) or (3).

Related: [ADR-057](../architecture-decision-records/adr-057-dockview-stays-external.md),
[ARCHITECTURAL_LIMITS](../reference/ARCHITECTURAL_LIMITS.md),
[app-core/CLAUDE.md](../../packages/app-core/CLAUDE.md).
