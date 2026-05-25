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
