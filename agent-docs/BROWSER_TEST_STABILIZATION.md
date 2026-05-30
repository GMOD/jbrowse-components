# Browser-test stabilization — status & next steps

Context: hardening the puppeteer e2e suite in
`products/jbrowse-web/browser-tests/` (no flaky waits, no leaks, clean setup).

## Fixed

- **`pageSnapshot`/`snapshot` loading-wait was broken/brittle.**
  `LoadingOverlay.tsx` always keeps the literal text `"Loading"` in the DOM
  (hidden via `opacity:0`); the `data-testid="loading-overlay"` attribute is the
  only reliable visibility signal. The old `textContent.includes('Loading')`
  wait was therefore *always* true → every full-page snapshot burned its full
  30s/10s timeout. A prior agent diagnosed this and switched `pageSnapshot` to
  `waitForLoadingOverlayGone(...)` but **timed out before defining it** — leaving
  a `ReferenceError`. Now defined in `snapshot.ts` (counts
  `[data-testid="loading-overlay"]`), applied to both `snapshot()` and
  `pageSnapshot()`.
- Removed leftover `_scratch_iterate.ts` synteny-debug script.
- Verified no `[timing]`/debug instrumentation remains; lint clean.
- **Consolidated `snapshot()` and `pageSnapshot()`** — they had become
  byte-identical. Removed `snapshot`; the 7 call sites (workspaces.ts,
  custom-url.ts) now use `pageSnapshot`.
- **Resource-leak hardening in `runner.ts`** (the real stability issue):
  - `killStaleTestBrowsers()` runs at startup: an external reaper is the only
    remedy for orphans left by SIGKILL/OOM-killed prior runs (puppeteer can't
    self-clean those — see puppeteer#1367/#12854). Kills only chromium-family
    processes carrying the `--enable-automation` token whose parent is no longer
    `node` (reparented to init/systemd ⇒ their runner died). Safe under the
    shared multi-agent worktree: a live run keeps `node` as parent, the user's
    real Chrome lacks `--enable-automation`, and non-browser `comm`s are
    excluded. Linux-only.
  - `trackBrowser()` + `process.on('exit')` backstop force-kills any browser
    *this* process launched that survives a crash path `finally` misses
    (uncaughtException, nested `process.exit`).
  - Verified end-to-end: custom-url suite passes in ~8s (no 30s burn), 0
    orphans left after the run, sweep correctly finds 0 false positives against
    live `ps`.

## Is the memory growth a JBrowse leak? (measured 2026-05-29)

No — it's swiftshader. A mount/unmount probe (toggle a GPU track open/close 12×
in one page, `window.DEBUG.webgl2=true`, `--js-flags=--expose-gc`, swiftshader
WebGL) breaks down as:

| Signal | Trajectory | Verdict |
| --- | --- | --- |
| WebGL `live` contexts | 0 every cycle (created==disposed) | GL teardown is 1:1 |
| Main JS heap | flat ~24 MB | no main-thread leak |
| GPU process RSS | 261→589 MB, **+29 MB/cycle linear** | **the leak (swiftshader)** |
| renderer RSS | 433→496 MB, plateaus | bounded |
| utility (workers) RSS | flat 175 MB | no worker leak |
| DOM nodes / listeners | +~44 / +~4 per cycle | small detached-DOM leak (2nd order) |

JBrowse disposes its GL context perfectly (`useRenderer` on unmount + pagehide;
`webgl2Hal.dispose()` deletes every buffer/program/texture/UBO). The unbounded
growth is Chrome's GPU process: **swiftshader doesn't return per-context memory
to the OS on destroy** — unfixable from JS. The per-test `browser.close()`+
relaunch in `runner.ts` is the correct mitigation. Real users on real GPUs don't
hit this (drivers free context memory; users don't churn contexts) — which is
why ordinary puppeteer scraping never sees it (no WebGL). To reproduce: enable
the `[WebGL2Hal #N] init/DISPOSING (live=…)` telemetry via `?webgl2-debug=1` or
`window.DEBUG.webgl2=true` and watch GPU-process RSS via
`ps -o rss=,args=` filtered on `--type=gpu-process`.

Headed vs swiftshader (confirmed on a dev box with Intel UHD 630 + display):
- headless, even `--ignore-gpu-blocklist`: Chrome falls back to SwiftShader →
  GPU process +29 MB/cycle, unbounded.
- **headed on the real GPU** (renderer = `ANGLE (Intel, Mesa Intel UHD 630)`):
  GPU process **flat ~223 MB over 10 cycles — leak gone.** The hardware driver
  frees per-context memory; swiftshader doesn't.

So "would headed avoid it?" — yes, but only because headed makes Chrome use the
*real GPU* (needs a GPU + display, i.e. local dev). It is **not** a CI fix: CI
has no GPU, so headed-under-xvfb still lands on swiftshader. Real optimization:
gate the per-test browser recycle on swiftshader use so local headed runs skip
it (big speedup); keep it for the CI swiftshader path.

Secondary follow-up: the detached-DOM leak (re-measured 2026-05-30, still
present). A mount/unmount probe — `view.showTrack`/`hideTrack` a BigWig wiggle
track 16× in one page, force `gc()` each cycle — shows `page.metrics().Nodes`
growing a dead-linear **+56 nodes/cycle** (+~6 listeners/cycle; JS heap flat at
~22 MB). The *live* document is perfectly stable across cycles (1490 elements, 2
body children, 7 emotion styles, 0 popovers), so this is **retained detached
DOM, not portal/emotion residue** — the earlier MUI-portal hypothesis was wrong.

CDP `DOM.getDetachedDomNodes` pinpoints it: each leaked subtree is the **entire
`TrackContainer`** (root `MuiPaper-root` → dragHandle + track-menu →
`trackRenderingContainer` → `LinearWiggleDisplay` → canvas, 55 nodes), one per
close. Retaining any single node in that subtree pins the whole tree (parent +
child pointers), so the GC root is one reference into it — the leaked
per-cycle listeners and the WebGL canvas (held by the HAL) are the leading
suspects.

**This does NOT affect test cleanliness** — `runner.ts` recycles the browser
after every test and the page between suites, so nothing accumulates across the
suite. It is a *product* memory leak (real users opening/closing many tracks),
tracked here but out of scope for browser-test stabilization. Low priority.

## Signal reference (for future waits)

Two complementary completion signals exist:

- `data-testid="loading-overlay"` absent → display finished **fetching** data.
  Generic across all displays. Used by `waitForLoadingToComplete`/`waitForDataLoaded`
  (helpers.ts) and now the snapshot waits.
- `*-done` / `*_done` testid suffix → canvas finished **painting**
  (`canvasDrawn`/`rpcData` true). More precise but per-display and
  inconsistently named: `wiggle-display-done`, `display-${displayId}-done`
  (alignments/maf), `hic_canvas_done`, `ld_canvas_done`, `synteny_canvas_done`.
  Already used by `canvasSnapshot` (caller passes the exact selector) — which is
  why canvas captures are the most reliable.

## Next steps (ranked)

- **Paint-complete gate for full-page snapshots.** `pageSnapshot` only waits on
  `loading-overlay` (data fetched), not `*_done` (pixels painted) — a residual
  flake source with software WebGL. Optionally let callers pass the display's
  `*_done` selector to also gate on paint.
- **Profile the ~32s full-page synteny capture.** Hypothesis (unverified):
  `page.screenshot({ fullPage: true })` forces a resize + re-composite of every
  swiftshader WebGL canvas; canvas-only captures of the same view are fast.
  Confirm with split timings; if real, prefer element/canvas captures over
  `fullPage` for multi-canvas views.
- **Verify the large snapshot deletions** (`canvas2d/`, `webgpu/` dirs + root
  duplicates removed) are intentional before committing.
