# CLAUDE.md — jbrowse-web

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
