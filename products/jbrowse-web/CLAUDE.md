# jbrowse-web

**Measure load cost as JS bytes over the wire on the initial load**, page and
workers together (`browser-tests/measure-load.ts`, `worker-smoke.ts`), not
bundle size; round trips: `measure-load-latency.ts`.

## Browser (e2e) tests

Harness, goldens and readiness signals:
`agent-docs/reference/TEST_INFRASTRUCTURE.md`.

- **Build first** — the tests load `build/`, and a stale one gives false
  failures.
- **`suites/local-file-blob.ts` is the only check that a locally opened file
  resolves in the worker.** Jest runs worker code in the main thread's realm,
  where the blob map is already populated.
- **Publish goldens with `pnpm snapshots push --filter <suite>`** and commit
  `browser-tests/snapshots.lock`; a bare push rewrites the lock from every
  golden on disk, another agent's included.
- **Only canvas2d goldens travel.** WebGPU runs in Firefox, which follows the OS
  pixel ratio, so on a retina Mac every webgpu golden fails on size. Shoot them
  where the existing ones were shot; never `-u` them elsewhere.
- **A `-u` run rewrites every golden past the 0.5% gate**, not only the ones
  your change moved. Diff your captures against the same suites at the base
  commit (`probe-bar-top-aa.ts`) before calling an update yours.
- **Run one `runner.ts` per worktree at a time**; two take each other down.
  Check `ps -Ao command | grep runner.ts` first.
- **Key a probe against the built app off behavior**, not `constructor.name`,
  which is minified. Firefox clamps `performance.now()`; a probe needing real
  durations sets `privacy.reduceTimerPrecision: false` in `extraPrefsFirefox`.
