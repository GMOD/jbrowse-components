# CLAUDE.md — jbrowse-web

## Bundle-size analysis

Measure the metric that matters — **JS bytes over the wire on the initial
load** — not total bundle size. Webpack `splitChunks: { chunks: 'all' }` cut
total bytes ~7% but left the initial-load payload unchanged (the savings were
all in lazy chunks), so it was reverted. The real cost is that the cold start
screen eagerly loads ~2.2 MB of JS, dominated by a single ~1 MB chunk holding
*all* plugin code (`corePlugins.ts` is statically imported when the plugin
manager is built at boot). react-dom is also duplicated main↔worker (separate
webpack runtimes — `splitChunks` can't merge across that boundary).

Two harnesses (run after a `build`; serve from `build/`):

- `browser-tests/measure-load.ts` — CDP `encodedDataLength` JS bytes for the
  cold app shell vs opening a track. The test server serves uncompressed, so
  numbers are ~raw, but before/after deltas are apples-to-apples.
- `browser-tests/worker-smoke.ts` — opens a track headless and asserts the RPC
  worker spawns and renders with zero console errors. Guards any change to the
  main↔worker chunk boundary.

## Browser (e2e) tests

Always run `pnpm --filter @jbrowse/web build` before invoking any browser-test
runner command. The tests load the compiled `build/` directory; a stale build
will cause false failures (e.g. `_done` selectors not found, snapshot mismatches
from outdated code).

By default, GPU/WebGL lifecycle messages are suppressed (adapter fallback
notices, `[WebGL2Hal #N] init/dispose`, Chrome's `GroupMarkerNotSet` noise).
Pass `--debug` to see all browser console output:

```
node browser-tests/runner.ts --debug
```

To run a single suite or test, use `--filter=` (case-insensitive substring
against suite name) and `--test=` (substring against test name):

```
node browser-tests/runner.ts --filter="Alignments Color Schemes" --test="color by HP tag" -u
```

Real GPU errors (`context LOST`, `GL error`, `UNCAPTURED ERROR`) always show
regardless of debug mode.

### Waiting on loading / completion signals

`LoadingOverlay` always keeps the literal text `"Loading"` in the DOM (hidden
via `opacity:0`); only `data-testid="loading-overlay"` is removed when hidden.
So a `textContent.includes('Loading')` wait is _always_ true and burns its full
timeout — wait on the `loading-overlay` test-id count instead (the snapshot
helpers and `waitForLoadingToComplete`/`waitForDataLoaded` do this). For canvas
_paint_ completion (not just data-fetch) wait on the per-display `*-done` /
`*_done` test-id (`canvasDrawn`/`rpcData`), e.g. `synteny_canvas_done`; that's
what `canvasSnapshot` gates on, and why canvas captures are the most reliable.

### Leaked browser processes

`runner.ts` reaps orphaned test browsers at startup (`killStaleTestBrowsers`).
SIGKILL/OOM-killed prior runs leave Chrome reparented to init/systemd; these
accumulate (~300MB–900MB each) until the kernel OOM-kills a live renderer
mid-run. Puppeteer can't self-clean those — an external reaper is the standard
remedy:

- https://github.com/puppeteer/puppeteer/issues/1367
- https://github.com/puppeteer/puppeteer/issues/12854

The reaper only kills chromium-family processes carrying `--enable-automation`
whose parent is no longer `node` (so concurrent live runs and the user's real
Chrome are never touched).
