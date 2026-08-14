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
