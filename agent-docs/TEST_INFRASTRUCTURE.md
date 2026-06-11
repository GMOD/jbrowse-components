# Test Infrastructure

Browser tests (Puppeteer) in `products/jbrowse-web/browser-tests/`; unit tests
(Jest) co-located as `*.test.ts`.

## Browser tests

Build first: `pnpm --filter @jbrowse/web build`.

```sh
node --experimental-strip-types browser-tests/runner.ts                 # canvas2d (default)
node --experimental-strip-types browser-tests/runner.ts --backend=webgl
node --experimental-strip-types browser-tests/runner.ts --filter=alignments
node --experimental-strip-types browser-tests/runner.ts --headed         # debug
node --experimental-strip-types browser-tests/runner.ts --update-snapshots
```

~29 suites in `browser-tests/suites/` (alignments, variants, the synteny family,
dotplot, hic, gwas, methylation-modifications, svg-export, color-by-tag,
wiggle-color, main-thread-rpc, basic-lgv, …).

### Golden snapshots

Visual regression via pixelmatch (0.1% pixel-diff threshold), stored per backend
in `browser-tests/__snapshots__/{canvas2d,webgl,webgpu}/`. Cross-backend compare
(`compare-backends.ts`): identical / `<5%` similar / `≥5%` different. Intentional
change → `--update-snapshots`.

### WebGL / WebGPU

- **WebGL** — fully supported (Chrome headless / Firefox), CI default.
- **WebGPU local** (Firefox real GPU): `--backend=webgpu --headed`; set
  `FIREFOX_NIGHTLY_PATH` or pass `--firefox=/path/to/binary` to locate the binary.
- **WebGPU CI** (Linux + lavapipe): install `mesa-vulkan-drivers`, run under
  `xvfb-run` with `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json
  --backend=webgpu`. Chrome flags already set in `runner.ts`.
- **macOS** — real GPU, ~10× cost.

## Unit tests

Jest, co-located (`*.test.ts`), run with `pnpm test-ci`. Node-based and fast —
use for logic, config, RPC, and buffer packing; use browser tests for rendering
and UI.

## Wait signals

Two completion signals. **Do not** wait on `LoadingOverlay` text — it keeps the
literal `"Loading"` in the DOM at `opacity:0`, so a `textContent` check is always
true (this silently burned full snapshot timeouts).

- `data-testid="loading-overlay"` **absent** → data finished **fetching**
  (generic; used by `waitForLoadingToComplete` / `waitForDataLoaded` and the
  snapshot waits).
- `${base}-done` testid → canvas finished **painting** (gated on `canvasDrawn`,
  owned by `DisplayChrome` via its `testid` base prop). Per-display base, e.g.
  `wiggle-display-done`, `hic-display-done`, `ld-display-done`,
  `display-${displayId}-done` (alignments/maf). For tests that pixel-match or
  screenshot the canvas element, the inner `<canvas>` carries a **static**
  selector (`hic_canvas`, `ld_canvas`, `variant_canvas`,
  `variant_matrix_canvas`): wait on `${base}-done`, then read the static canvas
  selector. Standalone non-LGV displays keep self-contained `_done` selectors
  (`synteny_canvas_done`, `dotplot_webgl_canvas_done`). `canvasSnapshot` takes the
  exact selector — canvas captures are the most reliable.

## Troubleshooting

- **Stale build / `ChunkLoadError: Loading chunk N failed`** — rebuild:
  `rm -rf build && pnpm --filter @jbrowse/web build`.
- **Startup crash / `ERR_INSUFFICIENT_RESOURCES` / "HistoryService::Init() failed"**
  — corrupted Puppeteer cache: `rm -rf /tmp/puppeteer_* /tmp/org.chromium.*`.
- **"libpxbackend-1.0.so not found"** — system snap Chrome is broken; use
  Puppeteer's cached binary (`~/.cache/puppeteer/`).
- **Port 3333 in use (`EADDRINUSE`) / stray processes** —
  `fuser -k 3333/tcp && pkill -9 chrome firefox`. `runner.ts` also reaps stale
  automation browsers at startup (`killStaleTestBrowsers`, Linux-only) and
  force-kills its own launched browsers on exit.
- **Console errors** — runner forwards `[alignments]` / `[webgl-wiggle]` logs;
  add patterns in `runner.ts`.

### Cross-test memory growth is SwiftShader, not a JBrowse leak

(Measured 2026-05-29.) JBrowse disposes GL contexts 1:1 (`useRenderer` unmount +
`pagehide`; `webgl2Hal.dispose()` frees every GL object) and the main JS heap
stays flat. The unbounded `~29 MB/cycle` is Chrome's **GPU-process RSS under
SwiftShader**, which never returns per-context memory to the OS — unfixable from
JS. Headless always falls back to SwiftShader (even with `--ignore-gpu-blocklist`);
only headed-on-a-real-GPU avoids it, so it is **not** a CI fix. Mitigation:
`runner.ts` recycles the browser per test (see
`adr-024-per-backend-snapshots-real-gpu.md`). Repro: enable `?webgl2-debug=1`
(or `window.DEBUG.webgl2=true`) telemetry and watch `--type=gpu-process` RSS via
`ps -o rss=,args=`.

A separate, lower-severity **product** leak (not a test-cleanliness problem,
since the browser recycles per test): closing a track retains its entire
detached `TrackContainer` subtree (~55 nodes, ~6 listeners/cycle), GC-rooted via
a leaked listener or the HAL-held canvas.

## Open follow-ups

- **Paint-complete gate for `pageSnapshot`.** It waits on `loading-overlay`
  (data fetched) but not `*_done` (pixels painted) — a residual software-WebGL
  flake source. Optionally let callers pass a `*_done` selector.
- **Profile the ~32s full-page synteny capture.** `fullPage` screenshots may
  force a resize + re-composite of every SwiftShader canvas; canvas-only captures
  of the same view are fast. Confirm with split timings; prefer element/canvas
  captures for multi-canvas views.
