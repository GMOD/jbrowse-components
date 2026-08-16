# jbrowse-web

## Bundle size

Measure **JS bytes over the wire on the initial load**, not total bundle size —
`splitChunks: { chunks: 'all' }` cut total bytes ~7% while leaving the initial
payload unchanged, so it was reverted. `browser-tests/measure-load.ts` and
`worker-smoke.ts` are the harnesses (run after a build).

## Browser (e2e) tests

Always build first — the tests load `build/`, and a stale one gives false
failures. `--debug` unsuppresses GPU/WebGL console noise.

**`suites/local-file-blob.ts` is the only check that a locally-opened file still
resolves in the worker**, and it has to run here: the worker's blob map is
installed by `RpcMethodType.invoke` and by nothing else, but every jest test
runs worker code in the main thread's realm, where the map is already populated
and a method that skips installing it reads the right answer by accident.

**Goldens are not in git.** `__snapshots__/` is gitignored; the bytes live in
`s3://jbrowse.org/jb2-snapshots/` and git tracks `browser-tests/snapshots.lock`.
`pnpm snapshots` is the CLI, and the runner pulls what the lock names before it
compares, so a fresh clone needs no command.

- **`pnpm snapshots push` after an `--update-snapshots` run**, then commit
  `snapshots.lock`. **Pass `--filter` in a shared worktree**: a bare push
  rewrites the lock from every golden on disk.
- **`pull` will not overwrite a golden that is not in the store**, because those
  bytes exist nowhere else. `--force` discards them.
- Goldens remain **environment-specific** — a real-GPU webgl golden will not
  match a swiftshader capture, and only canvas2d really travels. CI compares
  backends against each other.
- **Never screenshot with `fullPage: true`.** Puppeteer resizes the viewport to
  implement it, which invalidates the raster; under concurrent browser churn the
  capture returns before the content re-rasters, reported as a 10-25% snapshot
  regression that moves run to run. Use `page.setViewport`.
- **Don't wait on `textContent.includes('Loading')`** — `LoadingOverlay` always
  keeps that literal in the DOM, so the wait is always true and burns its full
  timeout. Wait on the `loading-overlay` test-id count, or `data-display-drawn`
  for canvas paint (`findDisplayPainted`).
- `runner.ts` reaps orphaned test browsers at startup; SIGKILLed prior runs
  otherwise accumulate until the kernel OOM-kills a live renderer mid-run.
- **A box's height cannot tell hard line breaks from wrapped text.** Anything
  asserting that text laid out as N lines counts LINE BOXES —
  `range.selectNodeContents(el); range.getClientRects().length` — because a
  collapsed multi-line string just wraps at `maxWidth` and stays tall.
  `comparative-tooltips.ts` carries the measured pair. **Mutate the source and
  rebuild before believing a layout assertion**: the first spelling of that
  check passed against a deliberately broken build.
- **`pnpm review-snapshots-web` rebuilds its page on every load**, so editing
  `browser-tests/review-app/` needs a reload, not a restart. It shares its write
  protocol and repaint properties with the website's screenshot review via
  `@jbrowse/browser-test-utils/reviewApp` — fix a protocol bug in the shared
  client and run `reviewAppProbe.ts` after.
- **Two traps when writing a probe against the built app**, both of which
  produce a confident wrong answer rather than an error. **`constructor.name` is
  minified** — the bundle a probe loads is the production build, so every
  backend, model and renderer answers to a two-letter name and a check like
  `backend.constructor.name.startsWith('Gpu')` reports the GPU path as absent.
  Key off behavior or off the app's own console lines instead. And **Firefox
  clamps `performance.now()`** for fingerprinting resistance, coarser than
  anything sub-millisecond, so every duration column reads `0.000` whatever the
  truth is; a probe that needs real durations sets
  `privacy.reduceTimerPrecision: false` in `extraPrefsFirefox`, which the runner
  deliberately does not (a test should see what a user's browser does).
- **A verdict paints; it does not resize.** Anything that moves a button between
  a mousedown and its mouseup makes the browser dispatch no click at all,
  reported as "I had to press Deny twice". So in header and card: nothing a
  verdict or background pass can change is conditionally MOUNTED (use
  `visibility: hidden` or `disabled`), every count sits in a fixed-width slot,
  and a pill that comes and goes gets a reserved row. Measure a change by
  driving the real page with puppeteer and comparing `getBoundingClientRect()`
  across the write.
