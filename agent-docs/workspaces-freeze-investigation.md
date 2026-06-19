# Workspaces (dockview) freeze investigation — handoff

## Goal (user decision)

User **likes dockview and wants to keep it**. So: do NOT remove/disable
workspaces or change the global-flag persistence. Find and fix **why dockview is
slow with many views**, keeping dockview working.

## Cross-ref

Part of the PneumoBrowse2 v5.0.0 beta report triage —
[`pneumobrowse-v5-bugreport-triage.md`](./pneumobrowse-v5-bugreport-triage.md)
issue #2. The reporter's separate "can't scroll the genome list on my main
browser, but incognito is fine" complaint is the **same bug**: their main browser
has `localStorage['useWorkspaces']` persisted on, so it loads straight into
dockview and freezes. New data point: their freeze is ~25 real genome views with
real tracks (CRAM/synteny/wiggle), reproducible just by toggling the flag.

## Background

Reporter opens a stack of genome views (strains: D39V + others). With
`localStorage['useWorkspaces']` truthy, `ViewsContainer.tsx:35` routes to
`TiledViewsContainer` (dockview). Symptoms: can't scroll the genome list /
header unreachable, and "activating workspaces freezes the list, deactivating
makes it normal." Classic container is fine with the same views.

## Findings this session

- **"Can't scroll" is the freeze symptom, not a CSS dead-end.**
  `JBrowseViewPanel.tsx:14-19` already has `overflowY: auto; height: 100%`, so the
  panel is scrollable. The list is just unresponsive because the main thread is
  stalled.
- **No infinite loop (static analysis).** The two autoruns in
  `TiledViewsContainer.tsx` converge: the view→panel assignment autorun
  (`:252-287`) reaches a fixpoint after one re-run; `assignViewToPanel` does NOT
  change `serializeLayout` output (view assignments live on the session, dockview
  `toJSON` has params blanked — `dockviewUtils.ts:57-87`), so there is no
  assignment↔layout ping-pong with the undo/redo autorun (`:290-316`).
- **HYPOTHESIS TESTED AND DISPROVEN: dockview does NOT cause width-set thrash.**
  Each `ViewContainer` runs a ResizeObserver (`useWidthSetter` →
  `packages/core/src/util/hooks.ts`) that calls `view.setWidth()` on width change,
  which re-lays-out + re-renders the whole view. I instrumented `setWidth`
  (gated `globalThis.__WIDTH_DEBUG__`) and ran the stress suite with 12 views:
  - CLASSIC: totalSetWidth=12, 1 per view, single burst at t=0.
  - TILED (all 12 in one panel): totalSetWidth=12, 1 per view, single burst.
  Identical. dockview is **not** re-triggering view re-layout. Mechanism is
  elsewhere.

## REPRODUCED (2026-06-18) — root cause is GPU **context exhaustion**, not dockview

Built `@jbrowse/web` and ran a standalone headed-Chrome stress harness on the
**real GPU** (webgl backend), N genome views each carrying real tracks, comparing
Classic vs Tiled with the SAME session. Per-mode metrics: total live WebGL
contexts, `context LOST` count, load wall-time, and a 3s rAF-interval +
`longtask` responsiveness probe while programmatically scrolling the view list.

Results scale cleanly with **canvas/context count**, not with the container:

| Config | canvases | `context LOST` | scroll | verdict |
|---|---|---|---|---|
| N=20, 1 track/view | 20 | 4 (recovered) | ~22ms avg, smooth | **no freeze, Classic ≈ Tiled** |
| N=24, 3 tracks/view | 72 | **56** | single 143s frame / CDP timeout | **FREEZE** |

The freeze is the documented WebGL-resource-exhaustion failure
(`TESTING_INFRASTRUCTURE.md`): each display canvas gets its **own** WebGL2
context (`WebGL2Hal` constructor → `canvas.getContext('webgl2')`, module-level
`totalCreated` counter, **no pooling**). 72 contexts ≫ Chrome's ~16-per-page
cap → Chrome force-loses the oldest → `useRenderingBackend`'s context-loss
recovery (`contextVersion` bump → dispose + recreate backend) creates a fresh
context → evicts another → unbounded cascade that wedges the main thread.

**Which container freezes depends on run ORDER, not on Classic vs Tiled.** Cold
(first) run freezes; warm (second) run benefits from OS-file/GPU-driver warmth
and often survives. Running Classic-first froze Classic; running Tiled-first
froze Tiled. So the prior worry — "Classic also lacks windowing, confirm it's the
differentiator" — is **answered: Classic is NOT meaningfully better; both freeze
at scale.** dockview is exonerated as the cause.

### WebGPU (Firefox Nightly) — also fails at scale, distinct mechanism

Re-ran the same N=24 × 3-track session on **WebGPU via Firefox Nightly** (the
reporter's backend family). A **single** view renders fine (1 canvas). At 24×3
the 24 `view-container` DOM nodes appear (~8s) but **zero `<canvas>` ever
mounts** and no loading overlay appears, sustained for 56s+ — the GPU canvases
never come up. WebGPU shares ONE `gpuDevice` singleton (no WebGL 16-context
cap), so this is NOT the WebGL cascade; it's a distinct failure (likely a
per-document `GPUCanvasContext`/memory ceiling or main-thread saturation during
mass canvas-context creation). **Not cleanly isolated** — reported as-is.

The unifying root cause across both backends: **too many simultaneous live GPU
canvases.** The reporter's "dockview freezes, classic fine" is best explained by
timing/cold-start tipping (matches our order-dependence on WebGL), not a dockview
code path.

(To re-run WebGPU: `BROWSER=firefox BACKEND=webgpu` env on the scaffold; seed
`localStorage` only AFTER an initial `page.goto(origin)` — Firefox BiDi throws
"Permission denied" touching `localStorage` on `about:blank` — and use
`waitUntil:'load'`, since Firefox stalls on `networkidle0`.)

## The fix — IMPLEMENTED + VERIFIED (2026-06-18)

The lever: **bound the number of simultaneously-live GPU canvases/contexts.**
Implemented at the **view level** (per maintainer steer — one observer per view,
drops all of a view's canvases together; per-display gating can come later):

- **`packages/app-core/src/ui/App/useViewVisibility.ts`** (new) — an
  `IntersectionObserver` (root = viewport → container-agnostic across Classic and
  dockview) with a generous `rootMargin: '150% 0px'` (1.5 viewport-heights)
  reports whether a view is near the visible band. A `ResizeObserver` remembers
  the view's last rendered height. **Starts hidden** so a cold load with N
  crammed views doesn't mount them all at once. **Falls back to always-visible
  when `IntersectionObserver` is absent** (jsdom/SSR) — keeps the test suite and
  non-browser envs on the pre-lazy-mount behavior.
- **`ViewContainer.tsx`** — `ViewHeader` always renders (headers stay reachable —
  the reporter's literal "header unreachable" symptom); `ViewWrapper` (GPU-heavy
  track area) mounts only when visible, else a height-preserving spacer
  (`view.height` when present, else 400px estimate). Unmounting `ViewWrapper`
  disposes its displays' GPU backends via `useRenderingBackend` cleanup.

### Verification (N=24 views × 3 tracks = would-be 72 canvases)

| backend / mode | canvases | context LOST | scroll | verdict |
|---|---|---|---|---|
| WebGL Tiled — **before** | 72 | 56 | one 143s frozen frame | FREEZE |
| WebGL Tiled — **after** | **6** | **8** | median 20ms (p95 ~248ms churn) | no freeze |
| WebGPU(FF) Classic — **before** | 0 (never mount) | n/a | stuck | broken |
| WebGPU(FF) Classic — **after** | **6** | 0 | median 22ms (p95 ~146ms churn) | works |

Unit test: `useViewVisibility.test.ts` (gating + jsdom-fallback). Full-app jsdom
render unaffected (`BasicLinearGenomeView.test.tsx` 10/10 green).

### Known tradeoff + follow-ups

- **Scroll-churn jank** (p95 ~150–250ms under an aggressive 120px/frame
  programmatic sweep; median stays ~20ms). Mounting/unmounting a whole LGV on
  scroll is heavy. Tunable: debounce the *hide* transition (keep mounted a beat
  after leaving the margin) and/or widen `rootMargin`. Real users scroll slower
  than the probe, so real-world churn is milder — left as a tuning follow-up.
- **Residual at extreme density:** ~3 GPU tracks/view × ~6 visible views ≈ 18
  contexts, still near the WebGL 16-cap (hence the surviving 8 losses, all
  recovered, no freeze). If it ever bites, the WebGL-only **Canvas2D fallback on
  context-loss thrash** is the backstop (count `webglcontextlost` in
  `useRenderingBackend`; after K losses recreate as Canvas2D — the ladder +
  per-display Canvas2D backends already exist). DEPRIORITIZED: it's WebGL-only
  (WebGPU's shared `gpuDevice` won't fire it), and WebGL is the shrinking backend.

### Context-loss recovery (GPU "sad icon")

The GPU error overlay already had a **manual** Retry button (`ErrorBar` →
`IconButton[data-testid=reload_button]`, wired via `DisplayChrome`'s
`onRetry={retry}`). Added **bounded auto-recovery** in `useRenderingBackend`:

- On `webglcontextlost`, a sticky `contextLostRef` arms recovery (scopes it to
  genuine GPU context loss — config/render-logic errors are never auto-retried).
- While `renderError` is set and armed, re-init on exponential backoff
  (`MAX_CONTEXT_RECOVER_ATTEMPTS=2`, `CONTEXT_RECOVER_BASE_MS=1000` → 1s, 2s),
  one pending timer at a time.
- The attempt budget resets ONLY on a genuine browser `webglcontextrestored` or
  a manual retry — never on a bare re-acquire. So a context that keeps
  re-losing climbs to the cap and **stops** (leaving the manual button); it
  **cannot spin in an infinite loop / thrash the page**. Deliberately leans on
  manual recovery past the cap.

Tests: `useRenderingBackend.test.ts` adds "auto-recovers … a bounded number of
times, then stops" and "does not auto-recover a non-context render error".
(Note: jest fake timers block React's passive-effect flush, so the recovery
effect runs with no dep array + idempotent guards and is tested with real
timers.)

### Note on `searchUtils.ts`

`plugins/linear-genome-view/src/searchUtils.ts` had a build-breaking malformed
type-import (`import type { default as X, Y }`) from a concurrent edit; split
into two `import type` lines to unblock the tree (intent preserved). Unrelated to
this fix.

## How to reproduce (standalone harness — not committed)

Headed Chrome on the real GPU, set `localStorage['useWorkspaces']` per mode,
load a session spec of N views each with `tracks:[...]`, count `[WebGL2Hal #]`
console lines + `context LOST`, sample rAF frame intervals while scrolling. Key
knobs that matter: **canvas count = N × tracks/view** (freeze appears ~70+
contexts on this GPU), and **run order** (cold mode freezes). Scaffold:
`agent-docs/repro-workspaces-freeze.ts` (imports the repo's `startServer` +
`encodeSessionSpec`; copy into `products/jbrowse-web/browser-tests/` and run with
`node browser-tests/repro-workspaces-freeze.ts`, env `N=`, `TRACKS=`, `LOC=`,
`ORDER=tiled-first`). The prior `useWidthSetter` width-debug instrumentation in
`packages/core/src/util/hooks.ts` has been **removed** — the width-thrash
hypothesis is fully retired.
