# JBrowse Web Browser Tests

This directory contains Puppeteer-based browser tests that run against a real
browser instead of jsdom.

## Prerequisites

Build jbrowse-web first:

```bash
cd products/jbrowse-web
pnpm build
```

## Running Tests

From `products/jbrowse-web`:

```bash
# Run tests in headless mode
pnpm test:browser

# Run tests with visible browser
pnpm test:browser:headed

# Update canvas snapshots
pnpm test:browser:update
```

Or run directly:

```bash
node browser-tests/runner.ts
node browser-tests/runner.ts --headed
node browser-tests/runner.ts --headed --slow-mo=100
node browser-tests/runner.ts --update-snapshots

# Run specific suites (comma-separated or multiple flags; auto-enables remote):
node browser-tests/runner.ts --filter=grape,hs1
node browser-tests/runner.ts --filter=grape --filter=hs1

# Filter to a specific test within suites:
node browser-tests/runner.ts --filter=synteny --test="chr7"

# Include suites that require remote data (S3/UCSC):
node browser-tests/runner.ts --include-remote
# (not needed when --filter is given — remote is auto-enabled)
```

## How It Works

1. The test runner starts an HTTP server that serves:
   - The built JBrowse application from `../build`
   - Test data files from `../test_data`

2. Puppeteer launches a real Chromium browser and navigates to the app

3. Tests interact with the app using Puppeteer's API to:
   - Find elements by test ID or text content
   - Click, type, and interact with the UI
   - Wait for elements to appear
   - Capture and compare canvas snapshots

## Screenshot Testing

The test runner supports visual regression testing using full page screenshots.
Snapshots are stored in `__snapshots__/` directory. On first run, snapshots are
created automatically. On subsequent runs, the current screenshot is compared
against the stored snapshot.

Use `--update-snapshots` or `-u` to update snapshots when intentional visual
changes are made.

### The goldens are a local tool — CI never runs them

Nothing in CI compares against a committed golden. The only render check on
`push` is the **cross-backend gate** (`pnpm test:browser:gate`), which renders
canvas2d and webgl in one run and diffs them against _each other_ — no
cross-machine baseline, so nothing to drift. It is `continue-on-error` anyway.

So the goldens only get refreshed when someone runs `-u` locally, and they drift
silently in between: as of 2026-07, 133 of 187 came from a single 2026-05-30
commit. **A large diff usually means weeks of other people's accumulated work,
not your change.** A 20% diff on a breakpoint golden turned out to be track
labels moving `overlapping` → `offset` (each track grows by a label row,
cascading every panel below it) — nothing to do with the change under test.

Before you `-u`:

1. **Prove the diff isn't yours.** Revert your change, rebuild, re-run. If it
   still fails, it is drift, and you are rubber-stamping someone else's work —
   fine, but say so, and eyeball `<name>.diff-visual.png` first.
2. **Check the capture is real.** `-u` writes whatever is on screen, including a
   half-loaded frame. Open the new PNG and confirm the data actually rendered.
3. **Only update goldens whose test failed.** The fullpage shots embed a live
   clock in the header, so every one of them differs slightly on every run (the
   thresholds absorb it). Rewriting a passing golden is pure churn.

Because a golden encodes one machine's rendering, treat a fresh one as evidence
about _this_ machine, not a cross-platform contract — that is exactly why the
cross-backend gate exists instead.

### Pileup goldens re-drift on every run — don't chase them

Alignment **pileup** captures are not reproducible run to run. The same build
re-run back to back against the same goldens fails a _different_ subset each
time (measured 2026-07-16: three pileups at 10.29/21.55/11.04%, then two at
20.76/11.04%). Pileup row assignment is arrival-order sensitive, so whatever
perturbs read order between runs reshuffles the stack into a large pixel diff.

`waitForMorphIdle` does not cover this: it waits on `morphFromTops`, which only
exists on `LinearBasicDisplay`, not `LinearAlignmentsDisplay`. So a `-u` on a
pileup golden buys nothing — it goes red again on the next run with a different
number. Regenerate them if you like, but expect ~10 of them red at any time, and
don't read those failures as a regression until the race is isolated. See
`crossBackendGate.ts`.

## Reviewing Snapshots

After a run, review the committed snapshots in a browser UI (mirrors the
website's `review-screenshots-web`):

```bash
pnpm review-snapshots-web      # http://localhost:3336
```

Two views:

- **Basic pass** — every snapshot one card; approve/deny whether the rendering
  is correct. Verdicts persist to `snapshot-review.json` (gitignored, local
  coordination only). Filter by name, review status, or kind
  (targeted/full-page/svg).

  Approvals are **sticky**: each verdict stores a hash of the image it was made
  against, so an approved snapshot only resurfaces (as "changed since review")
  when its pixels actually change — and re-validates automatically if an image
  is changed and then reverted to the approved bytes. The default "Needs review"
  filter hides approved-and-unchanged snapshots so you never re-litigate them.

- **Backends** — the same snapshot rendered by `canvas2d`, `webgl`, and `webgpu`
  side by side, with the pairwise drift % and a visual diff per pair. The
  "Drifting" filter surfaces snapshots whose backends disagree by ≥5% (the same
  similar/different split `compare-backends.ts` uses).

`compare-backends.ts` is the headless equivalent — it prints per-pair drift and
writes diff PNGs to `__snapshots__/backend-diffs/`:

```bash
pnpm test:browser:compare
```

## Adding Tests

Each file in `suites/` exports a `TestSuite` (or an array of them); the runner
auto-discovers them. Mark a suite/test `requiresRemote` (S3/UCSC data) or
`requiresAuth` to gate it.

Most tests just open a LinearGenomeView at a location with some tracks and
snapshot the rendered canvas. Use the `lgvSnapshotTest` factory for that — one
declaration per test:

```typescript
import { lgvSnapshotTest } from '../suiteHelpers.ts'

const suite: TestSuite = {
  name: 'My Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'BED track renders',
      snapshot: 'my-bed', // -> targeted_my-bed.png + fullpage_my-bed.png
      loc: 'ctgA:1-50000',
      tracks: ['bed_genes'],
      // doneTestId: 'pileup-display-done',  // for alignments/wiggle displays
    }),
  ],
}
```

For interaction or non-LGV views, write the `fn` by hand using the helpers
below. Reserve hand-written tests for what jsdom (the jest unit suite) can't do:
real GPU/shader output, devicePixelRatio, WebGL context loss, and the web-worker
RPC boundary — see `suites/gpu-quirks.ts`.

## Available Helpers

`helpers.ts`:

- `navigateWithSessionSpec(page, spec, config?)` / `navigateToApp(page, ...)` -
  load the app at a session spec / config
- `navigateToUrl(page, query)` - low-level goto for a raw `?<query>` string
  (share links, custom session params); uses the backend-aware wait so it
  doesn't stall the webgpu backend. Prefer the two above when they fit.
- `zoomOut(page, times?)` - click the zoom-out button N times, then wait for the
  re-fetch to settle
- `findByTestId(page, testId, timeout)` / `findByText(page, text, timeout)`
- `waitForDataLoaded(page)` / `waitForLoadingToComplete(page)` - wait on the
  `loading-overlay` test-id (data fetched). For canvas _paint_, wait on the
  per-display `*-done` test-id (`canvasDrawn`).
- `assertCanvasHasContent(page, selector, opts?)` - fail if a canvas is blank
- `delay(ms)`

`snapshot.ts`:

- `dualSnapshot(page, name, selector)` - targeted canvas + full-page snapshot.
  The targeted capture is gated on the canvas being non-blank (`assertContent`,
  default on) so a shader that draws nothing fails instead of silently passing.
- `canvasSnapshot` / `pageSnapshot` - the individual halves

`canvasContent.ts` / `pngDiff.ts` - blank-canvas detection and the shared
PNG-decode + pixelmatch diff used by snapshots, cross-backend comparison, and
the worker/main-thread consistency check.

## Auth Test Servers

This directory also contains test servers for HTTP Basic and OAuth
authentication testing.

### Running Auth Servers

```bash
# Start OAuth server (port 3030)
node browser-tests/OAuthServer/app.ts

# Start HTTP Basic Auth server (port 3040)
node browser-tests/HTTPBasicAuthServer/app.ts
```

### Testing Authentication

1. Start the OAuth and/or BasicAuth servers in separate terminals
2. Start jbrowse-web dev server
3. Visit http://localhost:3000/?config=test_data/volvox/config_auth.json
