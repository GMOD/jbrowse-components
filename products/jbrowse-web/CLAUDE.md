# jbrowse-web

## Bundle size

Measure **JS bytes over the wire on the initial load**, not total bundle size —
`splitChunks: { chunks: 'all' }` cut total bytes ~7% while leaving the initial
payload unchanged, so it was reverted. `browser-tests/measure-load.ts` and
`worker-smoke.ts` are the harnesses (run after a build).

## Browser (e2e) tests

Always build first — the tests load `build/`, and a stale one gives false
failures. `--debug` unsuppresses GPU/WebGL console noise; real GPU errors always
show.

**Goldens are not in git.** `__snapshots__/` is gitignored; the bytes live
content-addressed in `s3://jbrowse.org/jb2-snapshots/` and git tracks
`browser-tests/snapshots.lock`. `browser-tests/snapshot-store.ts` explains why,
with the measurement; `pnpm snapshots` is the CLI (`status`, `pull`, `push`).
The runner pulls what the lock names before it compares, so a fresh clone needs
no command — except under `--gate-only`, which never opens a golden.

- **`pnpm snapshots push` after an `--update-snapshots` run**, then commit
  `snapshots.lock`. Pass `--filter` in a shared worktree, for the reason
  `figures push` does: a bare push rewrites the lock from every golden on disk.
- **`pull` will not overwrite a golden that is not in the store**, because those
  bytes exist nowhere else — it names them and leaves them. `--force` discards
  them. The runner's own fetch only installs what is MISSING, so it can never
  take an unpushed regen.
- Goldens remain **environment-specific**, which the store does not change: a
  real-GPU webgl golden will not match a swiftshader capture, and only canvas2d
  (software, byte-identical run to run) really travels between machines. CI
  compares backends against each other rather than against these, which is why
  moving them out of git broke no check.

- **Never screenshot with `fullPage: true`.** Puppeteer resizes the viewport to
  implement it, which invalidates the raster; under concurrent browser churn the
  capture returns before the content re-rasters, reported as a 10-25% snapshot
  regression that moves run to run. Use `page.setViewport` if a view needs room.
- **Don't wait on `textContent.includes('Loading')`** — `LoadingOverlay` always
  keeps that literal text in the DOM, so the wait is always true and burns its
  full timeout. Wait on the `loading-overlay` test-id count, or the per-display
  `data-display-drawn` attribute for canvas paint completion
  (`findDisplayPainted` in `browser-tests/helpers.ts`).
- `runner.ts` reaps orphaned test browsers at startup; SIGKILLed prior runs
  otherwise accumulate until the kernel OOM-kills a live renderer mid-run.
- **`pnpm review-snapshots-web` rebuilds its page on every load**, so editing
  `browser-tests/review-app/` needs a reload, not a restart. It shares its write
  protocol, note drafts, card list and repaint properties with the website's
  screenshot review via `@jbrowse/browser-test-utils/reviewApp` — fix a bug in
  either page's card, but fix a protocol bug in the shared client, and run
  `node --experimental-strip-types src/reviewAppProbe.ts` in
  `packages/browser-test-utils` after touching it.
- **A verdict paints; it does not resize.** Both review pages have lost clicks
  to this and both have the scars: a control that appears when a write lands, a
  count that narrows as a sweep empties it, a 1px→5px border, a pill leaving a
  wrapping row. Any of them can move a button between a mousedown and its
  mouseup, and the browser then dispatches no click at all — which the reviewer
  reports as "I had to press Deny twice". So in the header and in the card:
  nothing that a verdict or a background pass can change is conditionally
  MOUNTED (use `visibility: hidden`, or `disabled`), every count sits in a
  fixed-width slot, and a pill that comes and goes gets a row whose height is
  reserved. Measure a change here rather than reasoning about it — drive the
  real page with puppeteer and compare `getBoundingClientRect()` across the
  write.
