# Browser-Test Next Steps

## What was done
- Removed lollipop browser test (SVG-based display, no canvasDrawn, selector never matched)
- Fixed variant_colors test region (ctgA:1-800 instead of 1-50000 to stay under maxFeatureScreenDensity)
- Added loading sentinel to `pageSnapshot()` — waits for "Loading" text to clear before screenshot
- Added `waitForFunction` for multiple synteny canvases in N-way/3-way synteny full-page tests
- Updated all WebGL snapshots

## Remaining flaky test
- "N-way synteny from PIF full page" still shows occasional 22.79% diff. The diff image reveals the golden was captured while synteny data was still loading (shows "Loading" text). The `pageSnapshot` loading sentinel should fix this — need to update the golden and verify across multiple runs.

## What was investigated and debunked
- **WebGL context leak hypothesis**: Tested 9 sequential navigations with single tracks — heap stable at ~20MB, no crash, no context accumulation. The browser GCs old contexts when navigating away even without explicit dispose(). The pagehide dispatch was added and then removed after proving it wasn't solving a real problem.
- **Earlier crashes (~4 tests in)**: Could not reliably reproduce in isolation. Likely caused by running multiple test processes simultaneously or transient machine load, not by WebGL resource leaks.

## Snapshot folder reorganization (requested by Colin)
- Move SVG exports (`svg-export-*.svg`) into `__snapshots__/svg/` subfolder
- Clean up `.diff.png` and `.diff-visual.png` artifacts (already gitignored but accumulate locally)
- Root `__snapshots__/` has stale PNG snapshots that duplicate the backend-specific subfolders (`webgl/`, `canvas2d/`, `webgpu/`). Consider removing root-level PNGs if no longer used

## GPU cleanup in production
- `useGpuRenderer` has two cleanup paths: React unmount effect and `pagehide` event handler
- React unmount covers in-app lifecycle (close track, switch view)
- `pagehide` covers navigation away / tab close (fires synchronously before page dies)
- Both are well-tested in real browsers. The `disposed` flag prevents double-dispose.
- Context loss recovery via `webglcontextlost`/`webglcontextrestored` is handled
- No evidence of leaks in production scenarios, but the `pagehide` handler in `useGpuRenderer.ts` has a comment claiming React cleanup doesn't fire during hard navigation — this is correct for tab close but should be verified for in-app scenarios where MST models are destroyed

## Stabilization ideas
- A DOM-level sentinel (e.g. `data-all-tracks-idle` on the root app element) set when all visible displays finish rendering would be more reliable than delays
- `canvasSnapshot` is inherently more stable than `pageSnapshot` — consider converting full-page tests to canvas-only where possible

## Lollipop plugin
- Browser test removed, plugin still in codebase. Colin mentioned it's "insanely neglected" — consider removing entirely or migrating to canvas rendering pipeline

## Test performance
- Full suite: ~8 minutes, 133 tests
- Pangenome-50 tests are heaviest (~29s each for full genome views, ~35s with loading sentinel)
- Parallelizing suites across browser instances would be the biggest speedup
