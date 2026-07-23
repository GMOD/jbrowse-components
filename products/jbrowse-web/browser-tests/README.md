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

### Nothing here runs in CI — these are local tools

**No part of this directory runs on `push`.** Not the goldens, and (since
2026-07-16) not the cross-backend gate either. Rendering is checked when a human
runs it, and only then.

The gate used to run non-blocking (`continue-on-error`) purely to publish drift
logs and diff artifacts. Nobody read them, its own premise turned out to be
false (see "Pileup goldens" below), and it cost a full jbrowse-web build plus a
two-backend render of every suite on every push. A check that gates nothing and
nobody reads is decoration, so it was removed. `pnpm test:browser:gate` is still
the right tool to run **by hand** when touching shaders or a backend — that is a
differential canvas2d-vs-webgl oracle and it does not need goldens.

Bringing it back as a real CI gate needs, in order: the pileup drift explained
(one contributing cause was fixed 2026-07-22 — see "Pileup goldens" below — but
it was never confirmed to be _the_ cause), a few consecutive clean runs on an
idle machine to prove the false-positive rate is 0, and then `continue-on-error`
dropped. Re-adding it non-blocking just recreates the decoration.

Note the gate needs a GPU backend, and GitHub runners have none — swiftshader is
the only GPU-less option and it leaks ~29 MB per WebGL context (ADR-024), which
is what drove this suite onto real GPUs. A full-suite CI gate is therefore not
on the table; a curated set of ~10 deterministic views is.

Because nothing refreshes the goldens but `-u`, they drift silently: as of
2026-07, 133 of 187 came from a single 2026-05-30 commit. **A large diff usually
means weeks of other people's accumulated work, not your change.** A 20% diff on
a breakpoint golden turned out to be track labels moving `overlapping` →
`offset` (each track grows by a label row, cascading every panel below it) —
nothing to do with the change under test.

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
about _this_ machine, not a cross-platform contract — that is what the
cross-backend gate is for, run by hand.

### Pileup goldens re-drift on every run — don't chase them

Alignment **pileup** captures are not reproducible run to run. The same build
re-run back to back against the same goldens failed a _different_ subset each
time (measured 2026-07-16: three pileups at 10.29/21.55/11.04%, then two at
20.76/11.04%). Pileup row assignment is first-fit-lowest-row, so anything that
perturbs the order reads are placed in reshuffles the stack into a large pixel
diff.

One input to that was fixed on 2026-07-22: every placement order in
`sortLayout.ts` now ends in a total tiebreak on genomic span + read id, so
layout is a pure function of the read _set_ rather than of array position. That
was a real defect — an unrecognized `sortedBy.type` also used to leave reads
entirely unsorted — and the invariant is pinned by "layout is independent of
read arrival order" in `sortLayout.test.ts`, a unit test that can't rot the way
an unrun browser suite does.

**It was not confirmed to be the cause of the golden drift.** Nothing was ever
shown to reorder reads between two runs: `@gmod/bam` walks chunks in a
sequential loop and CRAM record order is likewise deterministic, so the
arrival-order hypothesis is unsupported by anything but the symptom. Causes
still unexplored: the read _set_ differing between runs (block boundaries,
`maxRows` truncation) and capture timing — note `waitForMorphIdle` is vacuous
here, since it waits on `morphFromTops`, which exists on `LinearBasicDisplay`
and not `LinearAlignmentsDisplay`.

So: regenerate with `-u` if you like, but expect pileups red again, and don't
read those failures as a regression until the drift is actually explained. See
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
