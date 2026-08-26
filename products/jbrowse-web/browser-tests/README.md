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

# Every backend, webgpu included — the hand run, which `pnpm test:browser:gate`
# now spells. webgpu is Firefox Nightly (--firefox=<path> or
# FIREFOX_NIGHTLY_PATH) and runs headed, so it needs a display.
node browser-tests/runner.ts --backend=all --swiftshader --gate-only

# Exactly what the blocking CI job renders — CI_GATE_SUITES, remote forced off.
# Scoping only, so it composes. --retries=N (default 1 under --ci-gate, 0
# otherwise) re-runs a failing test in a fresh browser and names it in the
# summary. It still skips webgpu, which the hand run above does not: that backend
# is Firefox Nightly, headed, and the ubuntu-latest job has neither it nor a
# display. See CROSS_BACKEND_GATE.md, "Widening the gate scripts".
node browser-tests/runner.ts --backend=all --skip-webgpu --swiftshader --gate-only --ci-gate

# The same set on the machine's real GPU. Use --real-gpu; do NOT just drop
# --swiftshader, which leaves headless Chrome on SwiftShader anyway (verified by
# browser-tests/probe-renderer.ts). --drift-report prints every compared pair's
# drift instead of the worst five, which is what a threshold audit reads.
node browser-tests/runner.ts --backend=all --skip-webgpu --real-gpu --gate-only --ci-gate --drift-report
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

The test runner supports visual regression testing using viewport screenshots
(never `fullPage` — see "Pileup goldens" below). Snapshots are stored in
`__snapshots__/` directory. On first run, snapshots are created automatically.
On subsequent runs, the current screenshot is compared against the stored
snapshot.

Use `--update-snapshots` or `-u` to update snapshots when intentional visual
changes are made.

An update run **only rewrites a golden whose capture actually moved** — past
0.5% of its pixels, or any change in canvas size. Rendering here is close to
deterministic, so without that gate every golden gets rewritten byte-for-byte
and the ones that genuinely changed are buried: one sweep over the display-mixin
refactor touched 117 files, of which 66 differed by under 0.1%. The run prints
what it wrote and by how much. Same idea, and the same 0.5%, as the website
screenshot generator's commit gate.

Pass `--force-snapshots` to rewrite everything regardless. Reach for it when a
change is real but smaller than the gate — a renamed label moves well under half
a percent of a full-page capture.

### What runs in CI: the cross-backend gate, blocking, on a curated scope

The **goldens never run in CI** — they encode one machine's rendering, so they
are checked when a human runs them and only then. The **cross-backend gate**
does, as the blocking `cross_backend_gate` job on every push:

```bash
pnpm test:browser:gate:ci    # CI_GATE_SUITES, remote off — exactly what CI runs
pnpm test:browser:gate       # every local suite — the hand-run tool
```

Both software-render webgl (`--swiftshader`), which is what CI has to do. To
exercise the machine's real GPU, pass **`--real-gpu`** — not merely the absence
of `--swiftshader`, which is what this line used to say and is wrong: headless
Chrome does not select a GPU on its own, so with no flag at all you get
SwiftShader again. `browser-tests/probe-renderer.ts` prints the renderer each
launch configuration actually gets, and the distinction matters because the
threshold audit in `crossBackendGate.ts` decides whether a drift is antialiasing
by whether it _moves_ between the two.

It is differential (canvas2d vs webgl, both rendered in the one run), so it
needs no committed baseline and cannot drift between machines. `--ci-gate`
scopes it to `CI_GATE_SUITES` in `crossBackendGate.ts`, which is where the
reasoning for the scope lives; it also forces remote data off, so no push
depends on S3/UCSC.

Blocking, this time, is the point. It ran `continue-on-error` over every suite
until 2026-07-16 and was removed, because a check that gates nothing and nobody
reads is decoration. What it needed was not a bigger scope but a verdict that
counts, and a scope narrow enough to deserve one:

- **Only views measured clean under swiftshader.** 66 pairs per run, 0 over
  threshold, worst passing drift 0.62% against a 1.5% default (was 0.51%/3% when
  the gate was made blocking) — the headroom is the argument, and the threshold
  was tightened once it had been measured rather than assumed. Alignments
  pileups are deliberately out (every over-threshold failure ever recorded here
  has been one) and so is anything fetching remote data.
- **A failing test fails the run.** A test that dies before its screenshot
  removes a pair from the comparison, and a snapshot only one backend captured
  is skipped rather than failed — so ignoring test failures let a run report "0
  over threshold" having compared 19 fewer pairs than the run before it. Under
  `--ci-gate` an uncompared pair is a failure too.
- **One retry per test, in a fresh browser, reported by name.** For the capture
  race described below, which no wait can fix. A drift verdict is computed once,
  after every test, and is never retried away.

Note the gate needs a GPU backend and GitHub runners have none — swiftshader is
the only GPU-less option, and it leaks ~29 MB per WebGL context (ADR-024), which
is what drove this suite onto real GPUs locally. A full-suite CI gate is
therefore not on the table; the curated set is ~2.5 min of rendering after the
build. Widening it is a measurement, not an edit.

### Blank captures: ask the canvas, don't wait harder

A capture can come back blank with every app-level signal legitimately true —
overlay down, no display `loading`, `canvasDrawn` set, morph idle (34 of 34
measured that way, on both backends). No amount of extra waiting fixes that, so
`canvasSnapshot` asks the canvas itself and puts the answer in the failure
message: `el.screenshot()` serves _composited_ layers, `canvas.toDataURL()`
reads the backing store, so content in one and not the other names the capture
path rather than the render.

**That answer diagnoses the blank; it is not a substitute capture.** Feeding
those bytes to the gate was tried and reverted on the evidence — a recovered
snapshot came back 93.65% different from the other backend's screenshot of the
same view, glyphs in identical places over a wholly different background,
because `toDataURL` does not flatten alpha and does not include DOM drawn over
the canvas. Comparing one backend's backing store against another's composited
layers compares capture paths, not renderers. A blank fails its test, and
`--ci-gate`'s retry takes it again through the same path on both sides. See
`agent-docs/reference/SCREENSHOT_CAPTURE_RACE.md`.

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

### Pileup goldens re-drift on every run — solved, it was `fullPage`

**Resolved 2026-07-26.** The moving 10-25% pileup failures were blank captures,
not layout drift: `page.screenshot({ fullPage: true })` makes puppeteer resize
the viewport to the scroll size and restore it after, and that resize
invalidates the page raster — under the runner's concurrent browser churn the
capture comes back before the content re-rasters, giving live app chrome around
a white content area. `pageSnapshot` takes a plain viewport screenshot now.
Alignments suite at concurrency 4: 5/5 runs failed 2-3 tests before, 7/7 clean
after, same build and goldens. **Never reintroduce `fullPage`** — a view that
needs more room gets a bigger viewport.

Every one of those failures was a **full-page** capture; the targeted canvas
captures of the same pileups passed in all 7 runs. If pileup goldens drift again
after this, it is a new phenomenon and wants a fresh measurement.

The history below is kept because the layout invariant it produced is real.

Alignment pileup captures looked unreproducible run to run: the same build
re-run back to back against the same goldens failed a _different_ subset each
time (measured 2026-07-16: three pileups at 10.29/21.55/11.04%, then two at
20.76/11.04%). Pileup row assignment is first-fit-lowest-row, so anything that
perturbs the order reads are placed in reshuffles the stack into a large pixel
diff — the hypothesis those numbers were read as supporting.

One input to that was fixed on 2026-07-22: every placement order in
`sortLayout.ts` now ends in a total tiebreak on genomic span + read id, so
layout is a pure function of the read _set_ rather than of array position. That
was a real defect — an unrecognized `sortedBy.type` also used to leave reads
entirely unsorted — and the invariant is pinned by "layout is independent of
read arrival order" in `sortLayout.test.ts`, a unit test that can't rot the way
an unrun browser suite does.

It was never the cause of the golden drift, and the doubt recorded at the time
was right: nothing was ever shown to reorder reads between two runs (`@gmod/bam`
walks chunks in a sequential loop, CRAM record order is likewise deterministic),
so the arrival-order hypothesis only ever had the symptom behind it. The symptom
belonged to the capture, not the layout. Note also that `waitForMorphIdle` is
vacuous for these tests — it waits on `morphFromTops`, which exists on
`LinearBasicDisplay` and not `LinearAlignmentsDisplay`.

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
      // displayTestId: 'pileup-display',  // for alignments/wiggle displays
    }),
  ],
}
```

For interaction or non-LGV views, write the `fn` by hand using the helpers
below. Reserve hand-written tests for what jsdom (the jest unit suite) can't do:
real GPU/shader output, devicePixelRatio, WebGL context loss, and the web-worker
RPC boundary — see `suites/gpu-quirks.ts`.

### Driving the live model

A suite reaching `window.JBrowseSession` inside `page.evaluate` needs a type for
it. **`Pick` the actions off the real model rather than restating them** — `tsc`
covers this directory, and a restated signature is the only reason it can't
catch a changed one. `suites/multi-region-sort.ts` is the worked example, and
the reason for the rule: it called `setSortedByAtPosition` positionally for six
weeks after it took one object, staying green because the sort it set named no
column and so sorted nothing.

```typescript
import type { LinearAlignmentsDisplayModel } from '@jbrowse/plugin-alignments'

interface Display extends Pick<
  LinearAlignmentsDisplayModel,
  'setSortedByAtPosition'
> {
  // read-back shapes stay hand-written and narrow — it is the calls that rot
  sourceSections: { laidOutPileupMap: ReadonlyMap<number, /* … */ unknown> }[]
}
```

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
  per-display `data-display-drawn` attribute (`canvasDrawn`).
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
