# CLAUDE.md — jbrowse-web

## Browser (e2e) tests

Always run `pnpm --filter @jbrowse/web build` before invoking any browser-test
runner command. The tests load the compiled `build/` directory; a stale build
will cause false failures (e.g. `_done` selectors not found, snapshot mismatches
from outdated code).
