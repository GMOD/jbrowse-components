---
name: figure-capture
description: The four ways a committed figure disagrees with what you meant — a misplaced callout, an empty capture from a readiness race, a blank or chrome-banded screenshot, a software-rasterized minutes-long render. Read before diagnosing an empty figure as a data bug.
audience: internal
kind: operations
---

# Capturing a figure

Four ways a committed PNG disagrees with what you meant, all in
`website/scripts/generate-screenshots.ts` and the browser-test suite rather than
the app: a callout resolves somewhere unintended, the capture lands before the
data arrived, the capture path returns something the renderer never drew, or
every WebGL draw runs on the CPU. **A figure that looks wrong is a harness bug
until the render is ruled out.**

## Where a callout lands

`website/CLAUDE.md` states the rule: never hand-measure a callout position;
every annotation `anchor`s, and a click anchors too. The vocabulary is
`AnnotationAnchor` in `packages/browser-test-utils/src/annotationOverlay.ts`,
shared with the desktop selenium harness. In order of preference: `track`+`locus`
(the live LGV model), `graphNode`, `selector`, `text`. Actions take the same shape
through `website/scripts/locusAnchor.ts`. `check-specs.ts` ratchets what is left
unanchored.

### What the types don't say

Each of these produces a plausible figure rather than an error:

- **The anchor's `dx`/`dy` and the annotation's own both apply, at different
  stages.** The anchor's shifts the resolved rect before `alignX`/`alignY` are
  read; the annotation's shifts the point afterwards. They differ only once an
  `alignX: 'right'` is involved.
- **A `fromAnchor` reads exactly like an `anchor`**, align included, so a tail can
  sit at an element's edge. A tail leaving one of our own text pills uses
  `leader` instead.
- **A `box` whose anchor sets `fracY` gets a zero-height band**, so `height`
  falls back to `2 * pad`. Supply `height`. Omitting `fracY` wraps the whole track
  band.
- **`pad` insets a box on every side** (default 6); explicit `width`/`height` are
  used verbatim while `x`/`y` still get the `pad`. Frames that must meet exactly
  want `pad: 0`.

### A label that points at something is one annotation

`leader: true` on a `text` annotation draws the label's arrow with it. The anchor
is what the callout names; the annotation's `dx`/`dy` place the label off it
(`dx`'s sign picks the side, its magnitude is the gap to the pill's facing edge,
`dy` centres the pill). The tail comes off the measured pill.

Two annotations (a text and an arrow) cannot do this: a pill's width is known
only once its text is measured in the page, so a spec can only guess it, and one
guess fits one label length. A `leader` whose pill covers its own target draws no
arrow and reports a miss, so the fix (raise `dx`) surfaces as an error.

`countDetachableLabels` (`screenshot-spec-rules.ts`, run by `check-specs`)
ratchets text+arrow pairs resolving to the same site; lower `LEADER_BASELINE` when
converting one. Only sideways pills are fragile, since horizontal is the axis
whose extent only the page knows.

`parseAnnotationLocus` accepts `..` as well as `-`, so a UI-printed location
(`chr10:122,835,344..122,837,142`) works both as a `text` anchor finding the DOM
cell and as a `locus`; one constant then keeps both callouts together.

### Converting a hand-placed coordinate without rendering

Everything comes off the committed PNG.

- **Halve everything.** Captures are `deviceScaleFactor: 2`. A `stageColumns`
  grid adds a 12px white border per panel (`GRID_GUTTER_PX / 2`); vertical stacks
  abut.
- **x is a locus**, exactly: `locus = windowStart + x * (windowBp /
  viewportWidth)`, because the tracks container spans the capture width from 0.
- **y is a depth into a track.** Track labels are in flow by default
  (`trackLabels` defaults to `offset`, plus `marginBottom: 4`), so in a default
  1500px capture the first track's rendering container starts at y = 193.
  Prefer `fracY: 0` plus `dy` when the display packs from its top; use a
  fraction when rows genuinely divide the height.
- **A committed figure records what its anchors resolved to.** An anchored
  arrowhead's tip is its element's centre (ray-cast from the known tail through
  callout red `#e3242b`). A `box`'s painted rectangle is its element's rect inset
  symmetrically by `pad + strokeWidth/2`, so its centre is the element's centre.

Draw the predicted geometry over the committed PNG and look at it before
spending a render.

### When not to anchor

- **A caption parked in a corner or margin** points at nothing; anchoring
  relocates it. Fix a collision as composition.
- **The tail of an arrow leaving such a caption.** Caption and tail are one unit
  in page coordinates; anchor both (the pill to the panel it sits over) or
  neither. `leader` makes the question moot where the callout can anchor to what
  it names.

### Verifying

`node --experimental-strip-types website/scripts/generate-screenshots.ts --check
--filter <spec> --exact --localport <free port>` renders twice and touches no
committed file. `drawAnnotations` throws on an anchor resolving to nothing, so a
clean run proves every anchor resolved. Always pass `--localport`: another run
holding the default port shows up as a blank page and a ready-gate timeout long
before `EADDRINUSE`.

A clean run does **not** prove the callout is in the picture: one that resolves
and then draws off-frame is silent. Check the drawn y against the capture height
when a callout hangs off content whose position a layout chooses.

Don't regenerate a figure to prove a conversion. A worktree carries other
agents' unlanded display edits and whatever `products/jbrowse-web` last built;
land the spec change and let the weekly sweep render it on a clean runner.

## An empty capture is the generator's readiness race

A canvas/GPU figure occasionally captures empty though the same spec renders on
the dev server and on clean re-runs. It is a capture race, not a data, adapter or
refName bug. Rule out the data path first, then look at readiness.

`canvasDrawn` can flip on an empty first paint, before features are fetched and
drawn. The first RPC on a session lazily boots the web worker, and the boot needs
the main thread to answer `readyForConfig`, so a heavy config or loaded machine
stretches the ready-but-empty window. A fixed `settleMs`, or a `readyText`
matching the track name, can pass inside it (both flagged in `website/CLAUDE.md`).

**Gate on a data-derived DOM signal.** The color legend exists only once data has
been binned: `FloatingLegend` (`packages/display-ui`) carries
`data-testid="floating-legend"`, and the spec sets `readySelector:
'[data-testid="floating-legend"]'`. If data never loads, the wait times out and
the spec fails loudly.

`readySelector` uses puppeteer `waitForSelector({visible:true})`.
`displayPainted('<name>-display')` fails it: GPU displays paint into a
`position:absolute` canvas, so the DisplayChrome element has height 0 (exists,
not visible). Pick a drawn element.

The generator also waits for `[data-app-phase="ready"]`, bounded by the spec's
`readyTimeout`, then fails the spec over any display still unpainted
(`waitForFrame`). A page with no canvas display passes at once. A spec's
`settleMs` is unread.

`RenderLifecycleMixin` skips a pan or zoom redraw while a canvas is off screen
but draws every upload, since a fetch commits one region at a time.
`offscreenTargetRelease.test.ts` pins the rule and `checkRingsPainted`
(`@jbrowse/browser-test-utils`) backs it up.

## A lost WebGL context commits a blank canvas, and the run says nothing

The browser drops the display's WebGL2 context mid-capture. The log prints
`CONTEXT_LOST_WEBGL: loseContext: context lost` and `[WebGL2Hal #n] context LOST`,
the run reports success, and the committed PNG has blank GPU canvases with every
readiness gate satisfied.

- **A run that logs a context loss is not a run whose figures you may commit.**
  Grep the log for `context LOST` before `figures:push` and re-shoot the specs it
  names. The ceiling is [GPU_CONTEXT_BUDGET.md](GPU_CONTEXT_BUDGET.md); `live=`
  is the count up when eviction started.
- **Concurrency is the lever.** The generator runs four specs at once, each a
  browser with its own contexts, so a figure stacking GPU displays loses them
  under a sweep and keeps them alone. Run such a spec on its own.

A page crash (`Page crashed!`) is the same failure one step further and fails
loudly with the committed PNG untouched. Whole-chromosome scatter, 300-row
clustered matrices and several deep pileups at once crash every attempt; land the
spec change and let the sweep draw it on an idle machine.

## The other blank capture: `el.screenshot()` vs the compositor

The browser-test suite (`products/jbrowse-web/browser-tests`) has a blank-capture
race no wait fixes. Every app-level signal was true (overlay down, no display
`loading`, every display `canvasDrawn`, morph idle) on both canvas2d and webgl, so
it is neither a driver nor a slowness story.

`el.screenshot()` serves composited layers; `canvas.toDataURL()` reads the backing
store. On a blank capture the two separate the causes: content in the canvas
means the capture path failed; a blank canvas means the render side failed. A
"render side" verdict is conclusive on canvas2d only, since a cleared webgl
drawing buffer reads identically.

**Those bytes diagnose the blank; they are not a substitute capture.**
`toDataURL` returns the canvas's own pixels with alpha unflattened, while
`el.screenshot()` composites the element box over its background and any DOM over
the canvas. Substituting one produced a false 93% drift against the other
backend. A differential oracle comparing a backing store against a composited
layer compares capture paths, not renderers. `assertCanvasHasContent` is the one
place the backing store is authoritative, because it compares no bytes.

### `el.screenshot()` scrolls the element first

Separate from a blank: the capture is full and byte-stable but wrong in a band at
the top. Puppeteer scrolls the element into view and Firefox moves an inner
scroller while `window.scrollY` stays 0, so the canvas top sits under the app
header and `el.screenshot()` composites 37px of header chrome into the element's
rectangle. That surfaced as canvas2d-vs-webgpu (Chrome-vs-Firefox) drift of 3-27%
on the alignments suites. The render was never wrong and the clip rectangle was
right.

- Read geometry **after** the screenshot, with `document.elementsFromPoint` down
  the band; a `[data-testid]` scan misses untagged layout divs.
- The band's apparent correlations (coverage strip, zoom level, WebGPU) were all
  downstream of the scroll; the band is fixed whatever `coverageHeight` is.

`captureElementPng` (`browser-tests/snapshot.ts`) is the path every element
capture takes. It reads the rect through the **selector**, calls
`page.screenshot({ clip })`, rereads the rect and throws if it moved. A threshold
override would have excused a harness artifact as a rendering difference.

- **Assert the rect through the selector, not an element handle.** A pileup
  display swaps its canvas element during capture on every run, so
  `el.boundingBox()` answers `null` for a page that never moved.
- **The scroll carried a compositor barrier.** `scrollIntoViewIfNeeded` awaits an
  `IntersectionObserver`, forcing a frame before capture. Removing the scroll
  removed it and blank captures rose, so the barrier is explicit now.
  `browser-tests/probe-capture-barrier.ts` measures the three paths.
- **`scrollIntoView: false` works at runtime but does not typecheck** (puppeteer
  declares it only on `screenshot`'s implementation signature), hence the clip.

## Slow figures are SwiftShader, not the app

`generate-screenshots` launches Chrome with `--enable-unsafe-swiftshader`, so
every WebGL draw rasterizes on the CPU. A large figure (`tcga/cohort_cnv_genome`:
1104 rows, 379k features, 23 regions, 1900px at dSF2) took 190-230s to become
ready; `--use-angle=gl` or `--headed` (real GPU) renders it in 14s and `--check`
then reports 0.000% drift where software raster needed `diffThreshold: 0.02`.

Everything JS-visible was small (worker CPU, `postMessage`, network, clustering,
GC). A Chrome `Tracing` task trace found the rest: renderer-main tasks of 3.6-26s,
each mirrored to the millisecond by a GPU-process task, i.e. the renderer blocked
synchronously on software rasterization.

**When wall clock far exceeds JS CPU on every thread, stop forming JS
hypotheses.** A sampling JS profiler reports the blocked thread ~99% idle. Four
JS-level explanations (stop-token sync-XHR, structured clone, background
throttling, RPC serialization) were each measured and refuted before the trace.

Tools in `website/scripts/`:

- `profile-spec.ts <spec>` — CPU profile of a cold load (main thread and every
  RPC worker) with a milestone timeline and per-file network attribution;
  `--angle-gl` renders on the GPU.
- `trace-rpc.ts <spec>` — per-method RPC counts and durations, plus worker-side
  sync XHR, `fetch`, `postMessage` and event-loop lag. A dead heartbeat means a
  blocked thread, not an idle one.
- `trace-tasks.ts <spec>` — Chrome-level task trace by thread. The tool of last
  resort.

To regenerate a slow figure use `--headed` (or `xvfb-run`). Capture geometry is
unaffected, since `setViewport` emulates device metrics. Don't raise timeouts
first. `tcga/cohort_cnv_genome.png` is the only GPU-rendered committed figure; no
CI job runs `generate-screenshots`, and switching the default would rewrite every
PNG once.

## Debugging tips

- `page.on('console')` forwards web-worker console, but the generator filters it.
  Attach a CDP `Target.setAutoAttach` session and read
  `Runtime.consoleAPICalled` to see the main/worker boundary. Added
  `console.error` instrumentation can shift timing enough to hide a race.
- Measure reliability with N forced runs and watch the content-stable diff
  percentage; a figure flipping between two states shows as an occasional large
  `% diff` on `--force`.
- A regen reporting the whole corpus changed is app drift since the last
  `Bump snaps` sweep, not the browser. `CHROME_PATH` pins one binary to check.
