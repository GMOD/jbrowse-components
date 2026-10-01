---
name: desktop-screenshots
description: The selenium harness that drives the packaged Electron app to produce the desktop figures — why a code change needs a fresh package build, how --only scopes a regen, and the failure modes that are not bugs. Read before regenerating a desktop figure.
audience: internal
kind: operations
---

# Desktop screenshot harness

`products/jbrowse-desktop/test/screenshots.ts` drives the packaged Electron app
over selenium and writes into `website/static/img/desktop-*.png`.

```bash
cd products/jbrowse-desktop
pnpm screenshots:headless --only desktop-blat,desktop-ispcr
```

`pnpm screenshots:build` chains `package:linux:no-installer` and
`screenshots:headless`.

**It renders the packaged app, so a code change needs
`pnpm package:linux:no-installer` first.** A stale binary fails with errors from
bugs already fixed in source.

`--only <substring>[,<substring>]` decides which files a run may write. The
desktop harness has no content-stable gate, so `--only` is all that keeps a
regen from re-encoding every other figure. A run walks the flow in `FIGURES`
order and stops once the last selected figure is written. `capture()` rejects a
name missing from `FIGURES`.

**Bundled data first, network last.** The flow captures everything that runs off
`test_data/` before anything that fetches from jbrowse.org. Opening a genome
after an hg19 session was torn down by "Return to start screen" hangs the import
form with the assembly stuck `initialized: false` and no error.

## Procedure figures

`test/procedures.ts` holds one entry per multi-part published PNG and one
`steps[]` entry per frame, each frame carrying its callouts.

- `procedureFrame(driver, figure, index)` captures frames at their natural points
  in the flow, so they are states of one real session. A figure that never
  completes fails the run.
- `@jbrowse/browser-test-utils/src/annotationOverlay.ts` draws the callouts, the
  same overlay the website's figure generator injects. Only the injection differs
  (`executeScript` here, `page.evaluate` there).
- **Anchor, never measure.** A callout names a `selector`, the `text` of a menu
  item or button, or (through `window.JBrowseSession`) a `track`/`locus` or a
  whole `view`. An anchor that resolves to nothing throws, so a renamed button
  breaks the regen. `alignX`/`alignY` place a badge beside a control.
- The harness trims each frame's dead bottom margin before stacking. Trimming
  measures the frame's own bottom row, so a callout in the margin survives.
- A frame is captured only when `--only` selects its figure.

## The BLAT figure

`desktop-ispcr.png` and `desktop-ispcr-results.png` are captured first.
`desktop-blat-steps.png` is one two-frame figure: the dialog with the sequence
typed, then the same dialog submitted. Order matters because submitting adds a
track and moves the view, so a pristine dialog captured afterwards would show
the result state.

Public UCSC BLAT sits behind a Cloudflare CAPTCHA and needs an account apiKey.
The result figure submits against a stand-in hgBlat the harness serves
(`MOCK_BLAT_RESPONSE`) through the url field under advanced settings. Everything
else on the path is real code.

`collapseGeneGlyph()` selects **Gene glyph** → **Longest coding transcript** by
`data-testid`, because the labels also appear in the track label, where a text
match resolves first.

## The CLI-config figure

`desktop-cli-config.png` runs the real `@jbrowse/cli` into a temp dir against the
bundled volvox files, then opens that `config.json`. It needs
`pnpm --filter @jbrowse/cli build` first.

- **It launches through a wrapper script, not `chromeOptions.args`.**
  chromedriver re-emits every args entry as a `--` switch, so a bare path
  arrives mangled. `createDriver({ launchFile })` writes an `exec`ing `sh`
  wrapper, the only route to the `jbrowse-desktop <file>` argv. A local config
  has no other entry point, since selenium cannot drive the native file picker.
- **It owns its own app instance**, so it runs first in `FIGURES`, and the run
  skips it when `--only` selects only later figures.
- **Build a fresh config every run.** Desktop treats the opened file as its
  session file and rewrites it (relative `uri`s become `LocalPathLocation`,
  `defaultSession` becomes current view state), even if the session launched no
  view.

## "Is it done loading?"

`waitForAppReady` in `test/harness.ts` reads the same signals as the web
generator (`products/jbrowse-capture/src/waits.ts`) through `executeScript`:

- `data-view-phase=loading`. Blocking.
- A visible `[data-testid="loading-overlay"]`. The idle overlay stays in the DOM
  at opacity 0, so the check walks visibility. Blocking.
- `data-display-phase=loading` and display wrappers still wearing their base
  test-id rather than `<base>-done`. Best-effort: a display in a terminal
  too-large/error state publishes no phase.

**The signals must stay clear for a settle window, not read clear once.** A
display's fetch autorun is debounced, so right after a navigation every signal
reads ready and the capture gets a blank canvas. The window has to outlast that
debounce. A timeout names what it was still waiting on.

## Asserting on the model, not on rendered text

Desktop publishes `window.JBrowseSession` / `window.JBrowseRootModel`, so
`readSession` / `waitForSession` can read each view's `visibleLocStrings`, track
ids and open widget types. Prefer that over the UI: the location box shows the
debounced `coarseVisibleLocStrings`.

`visibleLocStrings` reaches `view.width`, which throws on an unmeasured view, so
the probe guards each view. A binary built before the global existed makes the
harness log `WARN` and fall back to the DOM.

## Reading a failed run

- Every capture logs the size it is about to write (`inner`, `outer`, `body`,
  `dpr`). Committed figures are 1400x763, which is `inner 1400x763, outer
  1444x844`. The log shows which step changed the size.
- `desktop-debug-failure.png` goes to `tmpdir()` on any fatal error and ignores
  `--only`.
- Browser logs flush after the BLAT step as well as on fatal error.
- Two runs cannot overlap: `killProcesses()` runs at the start of each run, and
  its `pkill` patterns match only the unpacked binary this harness launches.

## Capture size

- **Window size comes from `windowStateKeeper`**, which persists into the
  userData dir a developer's real app also writes. The harness passes a fresh
  `--user-data-dir` (mkdtemp) per run.
- **The virtual screen must exceed the window.** `xvfb-run` defaults to
  1280x1024, which crops a 1400-wide window. `screenshots:headless` passes
  `-s "-screen 0 1920x1200x24"`.

Selenium cannot fix either afterwards: electron's chromedriver has no
`Browser.getWindowForTarget`, so `setRect()` throws.

## Not a bug: "submit did nothing"

`runQuery` closes the BLAT dialog only on success (hits, track, navigate,
`handleClose`). `submitUcscQuery` therefore gates in two steps: wait for the
dialog to close (if it stays open with Submit back out of `Searching…`, throw
with the dialog's text: not-found, error or CAPTCHA), then poll the location box
for the expected hit. It also asserts the URL field reads exactly the stand-in
url after `clearInput`, since a failed clear appends the mock url to the UCSC
default and reads as a network error.

## Why the implicit wait dominates a run

`setTimeouts({ implicit: 30000 })` makes every `findElements` that returns
nothing cost 30 seconds, and `cleanupUI` asks exactly that after each dialog.
Existence checks go through `countElements` (a `querySelectorAll` in
`executeScript`). Keep new waits off `findElements`.

## Opening the volvox genome

**Never send a plain `.fa` without a `.fai`.** It becomes `FastaAdapter`, which
downloads the whole FASTA and indexes it through the `indexFasta` IPC handler.
That step hangs often enough to fail a run, silently: the assembly sits at
`initialized: false` with an empty `error` and the import form reads "Loading"
forever. `openVolvoxGenome` gates on the assembly manager rather than the Open
button and names the assembly that never initialized.

A `.fai` in the set stops `classifyAssemblyFiles` falling back to the
self-indexing `FastaAdapter`; the e2e test does that. The figures send
`volvox.2bit`, which needs no index.

`sendKeys` types one character at a time, so `AddGenomePane` must keep its URL
box mounted while the text classifies as a sequence, or later lines are never
typed. `AddGenomePane.test.tsx` pins that.

## Unresolved

- **The app can die mid-run** (`NoSuchSessionError`), seen at the
  available-genomes step. Diagnosing needs the app's stderr, which chromedriver
  relays into the run log.
- **Figures render on Canvas2D.** `createDriver` passes
  `--disable-gpu --disable-software-rasterizer`, so the app falls back to
  Canvas2D, unlike the web generator's swiftshader WebGL2. Swapping the flags is
  untested.
- **A rare 845x763 capture** with the drawer at full width and the view column
  555px narrower matches docked DevTools. The per-capture size log will pin the
  step.
