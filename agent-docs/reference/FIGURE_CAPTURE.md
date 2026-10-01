---
name: figure-capture
description: Why does a committed web or desktop figure disagree with what you meant, and how do you regenerate one? Covers misplaced callouts, readiness races, blank captures, software-rasterized renders, and the selenium harness for the packaged Electron app.
audience: internal
kind: operations
---

# Capturing a figure

Four ways a committed web PNG disagrees with what you meant, all in
`website/scripts/generate-screenshots.ts` and the browser-test suite rather than
the app: a callout resolves somewhere unintended, the capture lands before the
data arrived, the capture path returns something the renderer never drew, or
every WebGL draw runs on the CPU. **A figure that looks wrong is a harness bug
until the render is ruled out.** The desktop figures come from a separate
selenium harness over the packaged Electron app ("Desktop figures").

## Where a callout lands

`website/CLAUDE.md` states the rule: never hand-measure a callout position; every
annotation `anchor`s, and a click anchors too. The vocabulary is
`AnnotationAnchor` in `packages/browser-test-utils/src/annotationOverlay.ts`,
shared with the desktop harness; prefer `track`+`locus`, then `graphNode`,
`selector`, `text`. `check-specs.ts` ratchets what is left unanchored.

Each of these produces a plausible figure rather than an error:

- **The anchor's `dx`/`dy` and the annotation's own both apply, at different
  stages.** The anchor's shifts the resolved rect before `alignX`/`alignY` are
  read; the annotation's shifts the point afterwards.
- **A `fromAnchor` reads exactly like an `anchor`**, align included. A tail
  leaving one of our own text pills uses `leader` instead.
- **A `box` whose anchor sets `fracY` gets a zero-height band**, so `height`
  falls back to `2 * pad`. Supply `height`.
- **`pad` insets a box on every side** (default 6); frames that must meet exactly
  want `pad: 0`.
- **A label that points at something is one annotation**: `leader: true` on a
  `text` annotation. A pill's width is known only once its text is measured in the
  page, so a text plus a separate arrow can only guess it. `countDetachableLabels`
  (`screenshot-spec-rules.ts`) ratchets such pairs; lower `LEADER_BASELINE` when
  converting one.
- **A caption parked in a corner or margin points at nothing**; anchoring
  relocates it. Anchor a caption and its tail both or neither.

### Converting a hand-placed coordinate without rendering

Everything comes off the committed PNG. Captures are `deviceScaleFactor: 2`, so
halve everything; a `stageColumns` grid adds a 12px white border per panel
(`GRID_GUTTER_PX / 2`). **x is a locus**: `locus = windowStart + x * (windowBp /
viewportWidth)`. **y is a depth into a track**: labels are in flow by default, so
prefer `fracY: 0` plus `dy` when the display packs from its top. Draw the
predicted geometry over the committed PNG before spending a render.

### Verifying

`node --experimental-strip-types website/scripts/generate-screenshots.ts --check
--filter <spec> --exact --localport <free port>` renders twice and touches no
committed file; `drawAnnotations` throws on an anchor resolving to nothing. Always
pass `--localport`: another run holding the default port shows up as a blank page
and a ready-gate timeout long before `EADDRINUSE`. A clean run does **not** prove
the callout is in the picture, since one that resolves and then draws off-frame is
silent.

Don't regenerate a figure to prove a conversion. A worktree carries other agents'
unlanded display edits; land the spec change and let the weekly sweep render it
on a clean runner.

## An empty capture is the generator's readiness race

A canvas/GPU figure occasionally captures empty though the same spec renders on
the dev server. It is a capture race, not a data, adapter or refName bug.
`canvasDrawn` can flip on an empty first paint, and the first RPC on a session
lazily boots the web worker, which stretches the ready-but-empty window on a
heavy config or loaded machine. A fixed `settleMs`, or a `readyText` matching the
track name, can pass inside it (`website/CLAUDE.md`).

**Gate on a data-derived DOM signal.** The color legend exists only once data has
been binned: set `readySelector: '[data-testid="floating-legend"]'`. It uses
puppeteer `waitForSelector({visible:true})`, so `displayPainted('<name>-display')`
fails it: GPU displays paint into a `position:absolute` canvas, so the
DisplayChrome element has height 0. Pick a drawn element.

The generator also waits for `[data-app-phase="ready"]`, bounded by `readyTimeout`,
then fails the spec over any display still unpainted (`waitForFrame`). A spec's
`settleMs` is unread. `RenderLifecycleMixin` skips a pan or zoom redraw while a
canvas is off screen but draws every upload (`offscreenTargetRelease.test.ts`).

## A lost WebGL context commits a blank canvas, and the run says nothing

The browser drops the display's WebGL2 context mid-capture. The log prints
`context LOST`, the run reports success, and the committed PNG has blank GPU
canvases with every readiness gate satisfied.

- **A run that logs a context loss is not a run whose figures you may commit.**
  Grep the log for `context LOST` before `figures:push` and re-shoot the specs it
  names ([GPU_PORTABILITY.md](GPU_PORTABILITY.md) §"The WebGL2 context budget").
- **Concurrency is the lever.** The generator runs four specs at once, each a
  browser with its own contexts, so a figure stacking GPU displays loses them
  under a sweep and keeps them alone. Run such a spec on its own.

`Page crashed!` is the same failure one step further; it fails loudly and leaves
the committed PNG untouched. Land the spec change and let the sweep draw it on an
idle machine.

## The other blank capture: `el.screenshot()` vs the compositor

The browser-test suite (`products/jbrowse-web/browser-tests`) has a blank-capture
race no wait fixes: every app-level signal was true on both canvas2d and webgl.
`el.screenshot()` serves composited layers; `canvas.toDataURL()` reads the backing
store. On a blank capture the two separate the causes: content in the canvas
means the capture path failed; a blank canvas means the render side failed, which
is conclusive on canvas2d only, since a cleared webgl drawing buffer reads
identically.

**Those bytes diagnose the blank; they are not a substitute capture.**
`toDataURL` returns unflattened alpha while `el.screenshot()` composites the
element box over its background and any DOM over the canvas. A differential oracle
comparing a backing store against a composited layer compares capture paths, not
renderers. `assertCanvasHasContent` is the one place the backing store is
authoritative, because it compares no bytes.

### `el.screenshot()` scrolls the element first

A full, byte-stable capture can be wrong in a band at the top: puppeteer scrolls
the element into view, the canvas top sits under the app header, and
`el.screenshot()` composites header chrome into the element's rectangle. That
surfaced as canvas2d-vs-webgpu drift on the alignments suites; the render was
never wrong. Read geometry **after** the screenshot with
`document.elementsFromPoint`; a `[data-testid]` scan misses untagged layout divs.

`captureElementPng` (`browser-tests/snapshot.ts`) is the path every element
capture takes: it reads the rect through the **selector**, calls
`page.screenshot({ clip })`, rereads the rect and throws if it moved. A threshold
override would have excused a harness artifact as a rendering difference.

- **Assert the rect through the selector, not an element handle.** A pileup
  display swaps its canvas element during capture, so `el.boundingBox()` answers
  `null` for a page that never moved.
- **The scroll carried a compositor barrier.** `scrollIntoViewIfNeeded` awaits an
  `IntersectionObserver`, forcing a frame; removing the scroll removed it and
  blank captures rose, so the barrier is explicit now
  (`browser-tests/probe-capture-barrier.ts`).

## Slow figures are SwiftShader, not the app

`generate-screenshots` launches Chrome with `--enable-unsafe-swiftshader`, so
every WebGL draw rasterizes on the CPU. A large figure
(`tcga/cohort_cnv_genome`) takes minutes to become ready where `--use-angle=gl`
or `--headed` (real GPU) takes seconds, and `--check` then reports 0.000% drift
where software raster needed `diffThreshold: 0.02`. A Chrome `Tracing` task trace
found it: renderer-main tasks mirrored to the millisecond by GPU-process tasks.

**When wall clock far exceeds JS CPU on every thread, stop forming JS
hypotheses.** A sampling JS profiler reports the blocked thread ~99% idle; four
JS-level explanations were measured and refuted before the trace. Tools in
`website/scripts/`: `profile-spec.ts` (cold-load CPU profile; `--angle-gl`),
`trace-rpc.ts` (per-method RPC counts; a dead heartbeat means a blocked thread),
`trace-tasks.ts` (Chrome task trace, last resort).

To regenerate a slow figure use `--headed` (or `xvfb-run`); capture geometry is
unaffected. Don't raise timeouts first. `tcga/cohort_cnv_genome.png` is the only
GPU-rendered committed figure, and switching the default would rewrite every PNG
once.

## Debugging tips

- `page.on('console')` forwards web-worker console, but the generator filters it.
  Attach a CDP `Target.setAutoAttach` session and read `Runtime.consoleAPICalled`.
  Added `console.error` instrumentation can shift timing enough to hide a race.
- A regen reporting the whole corpus changed is app drift since the last
  `Bump snaps` sweep, not the browser. `CHROME_PATH` pins one binary to check.

## Desktop figures

`products/jbrowse-desktop/test/screenshots.ts` drives the packaged Electron app
over selenium and writes `website/static/img/desktop-*.png`
(`pnpm screenshots:headless --only desktop-blat,desktop-ispcr`;
`pnpm screenshots:build` packages first).

**It renders the packaged app, so a code change needs
`pnpm package:linux:no-installer` first.** A stale binary fails with errors from
bugs already fixed in source.

`--only <substring>[,...]` decides which files a run may write; the harness has
no content-stable gate, so it is all that keeps a regen from re-encoding every
other figure. **Bundled data first, network last**: opening a genome after an
hg19 session was torn down hangs the import form with the assembly stuck
`initialized: false` and no error.

- **Procedure figures** (`test/procedures.ts`): one entry per multi-part PNG,
  `procedureFrame(driver, figure, index)` per frame. Callouts follow "Where a
  callout lands"; an anchor that resolves to nothing throws, so a renamed button
  breaks the regen.
- **BLAT figures:** capture `desktop-ispcr*.png` first, since submitting adds a
  track and moves the view. Public UCSC BLAT sits behind a Cloudflare CAPTCHA, so
  the result figure submits against a stand-in hgBlat (`MOCK_BLAT_RESPONSE`)
  through the url field. `submitUcscQuery` asserts the URL field reads exactly the
  stand-in after `clearInput`, since a failed clear reads as a network error.
  `collapseGeneGlyph()` selects by `data-testid` because the labels also appear in
  the track label.
- **`desktop-cli-config.png`** runs the real `@jbrowse/cli` (build it first) and
  opens that `config.json`. **It launches through a wrapper script**
  (`createDriver({ launchFile })`), because chromedriver re-emits every
  `chromeOptions.args` entry as a `--` switch. **Build a fresh config every run**:
  Desktop rewrites the opened file as its session file.
- **`waitForAppReady`** (`test/harness.ts`) reads the web generator's signals
  (`products/jbrowse-capture/src/waits.ts`). **They must stay clear for a settle
  window, not read clear once**: a display's fetch autorun is debounced, so right
  after a navigation every signal reads ready and the capture gets a blank canvas.
- **Assert on the model, not rendered text**: `readSession` / `waitForSession`
  read `window.JBrowseSession`. The location box shows the debounced
  `coarseVisibleLocStrings`.

### Reading a failed run

Every capture logs the size it is about to write; committed figures are 1400x763
(`inner 1400x763, outer 1444x844`). `desktop-debug-failure.png` goes to
`tmpdir()` on any fatal error and ignores `--only`. Two runs cannot overlap:
`killProcesses()` runs at the start of each run.

### Capture size

- **Window size comes from `windowStateKeeper`**, which persists into the userData
  dir a developer's real app also writes, so the harness passes a fresh
  `--user-data-dir` per run.
- **The virtual screen must exceed the window.** `xvfb-run` defaults to 1280x1024,
  which crops a 1400-wide window; `screenshots:headless` passes
  `-s "-screen 0 1920x1200x24"`.

Selenium cannot fix either afterwards: `setRect()` throws on electron's
chromedriver.

### Selenium traps

- **The implicit wait dominates a run.** `setTimeouts({ implicit: 30000 })` makes
  every `findElements` that returns nothing cost 30 seconds. Existence checks go
  through `countElements`; keep new waits off `findElements`.
- **Never send a plain `.fa` without a `.fai`.** It becomes `FastaAdapter`, which
  indexes through the `indexFasta` IPC handler, and that step hangs silently. The
  figures send `volvox.2bit`, which needs no index; `openVolvoxGenome` gates on the
  assembly manager.
- **`sendKeys` types one character at a time**, so `AddGenomePane` must keep its
  URL box mounted while the text classifies as a sequence
  (`AddGenomePane.test.tsx`).
- **Figures render on Canvas2D**: `createDriver` passes
  `--disable-gpu --disable-software-rasterizer`.
