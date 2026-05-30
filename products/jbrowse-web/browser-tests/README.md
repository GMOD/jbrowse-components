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

## Adding Tests

Each file in `suites/` exports a `TestSuite` (or an array of them); the runner
auto-discovers them. Mark a suite/test `requiresRemote` (S3/UCSC data) or
`requiresAuth` to gate it.

Most tests just open a LinearGenomeView at a location with some tracks and
snapshot the rendered canvas. Use the `lgvSnapshotTest` factory for that —
one declaration per test:

```typescript
import { lgvSnapshotTest } from '../suiteHelpers.ts'

const suite: TestSuite = {
  name: 'My Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'BED track renders',
      snapshot: 'my-bed', // -> targetted_my-bed.png + fullpage_my-bed.png
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
