# Workspaces (dockview) freeze investigation — handoff

## Goal (user decision)

User **likes dockview and wants to keep it**. So: do NOT remove/disable
workspaces or change the global-flag persistence. Find and fix **why dockview is
slow with many views**, keeping dockview working.

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

## CAVEAT — this run did NOT reproduce the freeze

The run above used the **canvas2d** backend and **empty** LGVs (no tracks), so
there was no heavy GPU content and no freeze in either mode. The reporter's
freeze needs heavy GPU genome views. The disproof of width-thrash still holds
(it's backend-independent), but the actual freeze cause is still open.

## Next steps (in order)

- **Reproduce the freeze first.** Re-run the stress suite with the **webgl**
  backend (real GPU, headed) AND add real tracks per view in
  `zzstress-workspaces.ts` (e.g. `tracks: ['volvox_sv_cram']` or a wiggle like
  `volvox_microarray` on each view). Confirm Tiled freezes / is much slower than
  Classic with the SAME views+tracks. If it does NOT, the freeze may be
  data-scale-specific (reporter has many real genomes) — note that.
- **Instrument render/commit cost, not setWidth.** Add timing/marks around the
  GPU draw/commit and count draws per frame; compare Classic vs Tiled for the
  same N. Look for what dockview *adds*: extra DOM/compositing layers, dockview's
  own resize/layout passes, scrollbar interplay, or a containing block that
  changes canvas sizing.
- **Profile the Classic→Tiled toggle transition** (the reporter's "activating
  freezes" path): toggling the flag remounts all N views into dockview at once.
  This one-time remount may be the stall.
- **Likely dockview-preserving fix: virtualize the panel view-stack.**
  `JBrowseViewPanel.tsx:62-64` renders ALL views of a panel with no windowing; on
  a fresh load the assignment autorun crams ALL N views into ONE panel. Windowing
  so only on-screen views mount/draw helps regardless of the exact cause and
  keeps dockview fully working. (Classic also lacks windowing, so confirm this is
  actually the differentiator before committing.)

## Files touched (clean up when done)

- **TEMP, REMOVE when finished:** `packages/core/src/util/hooks.ts` — gated
  `__WIDTH_DEBUG__` instrumentation in `useWidthSetter` (the `widthDebug()`
  helper + the console.log in the rAF). Harmless when flag is off.
- **NEW test harness:**
  `products/jbrowse-web/browser-tests/suites/zzstress-workspaces.ts` — stress
  suite (N=12 views, Classic vs one-panel Tiled, counts `[WIDTHSET]` logs +
  timeline). Keep or delete.

## How to run

```
# MUST rebuild web first (tests load build/, instrumentation is in core)
pnpm --filter @jbrowse/web build
cd products/jbrowse-web
node browser-tests/runner.ts --filter="ZZStress" --backend=webgl --debug
```
