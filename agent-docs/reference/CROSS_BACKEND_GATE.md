---
name: cross-backend-gate
description: The canvas2d-vs-GPU render gate that blocks CI — its scope, the measured drift behind the 1.5% threshold, and the methodology that made a threshold override a testable claim. Read before widening CI_GATE_SUITES or adding an override.
audience: internal
kind: operations
---

# The cross-backend render gate

`crossBackendGate.ts` diffs the canvas2d and GPU renders of the same run, so it
is a correctness oracle needing no golden. The `cross_backend_gate` job in
`push.yml` runs `pnpm test:browser:gate:ci` (`--ci-gate`): it scopes to
`CI_GATE_SUITES`, forces remote data off and renders under swiftshader. The job
blocks. An earlier non-blocking version was removed because a check nobody reads
is decoration.

## What made a blocking gate possible

1. **A scope whose noise floor sits far below the threshold.** The drift
   distribution over the `--ci-gate` scope is byte-identical across runs, which
   is what makes a tight threshold safe. `DEFAULT_THRESHOLD` leaves deliberate
   margin over the worst pair rather than hugging it, because this gate was once
   switched off for being noisy. The last baseline (2026-09-12, after the
   mark-grammar pass): median 0.00%, max 0.91% on `targeted_mark-ramp`, none
   over 1%. Re-measure with `--ci-gate --drift-report` and compare the whole
   distribution, not the max alone.
2. **The gate cannot pass by checking less.** An uncompared pair fails under
   `--ci-gate`, and the runner fails if a `CI_GATE_SUITES` name matches no
   suite.
3. **A blank capture fails its test and retries once in a fresh browser**,
   reported by name, on both sides of every pair.

**If a heavy full hand run flags a pair, re-run it scoped before believing
it.** A loaded `pnpm test:browser:gate` degrades captures, and a partial capture
is a fixed diff: the magnitude reproduces while the occurrence stays racy. CI
runs the narrower scope with a retry.

## The blank captures are the CAPTURE, not the render

Every wait in `waitForCaptureSettled` swallows its timeout and is re-checked
afterwards, with the verdict in the failure message. Blank captures report all
waits settled, so more app-level waiting does not fix them. The canvas2d
self-report reads "canvas HAS content while the screenshot is blank", which
places the fault on the capture side. A webgl self-report of "ALSO blank" proves
nothing, since a cleared drawing buffer reads identically; `canvasSelfReport`
says so, and `probe-canvas-selfreport.ts` prints both notes on a rendering page.

**Do not turn the canvas bytes into the capture.** `toDataURL` neither flattens
alpha nor sees DOM drawn over the canvas, while `el.screenshot()` composites
both, so a recovered capture compared against the other backend's screenshot
came back 93% different. A differential oracle must not compare one backend's
backing store against another's composited layers. `assertCanvasHasContent` is
the one place the backing store stays authoritative, because it compares no
bytes.

**The one wait that moves the blank rate is a browser-frame barrier.** An
`IntersectionObserver` callback is queued from update-the-rendering, so awaiting
one asks the browser whether it produced a frame. `captureElementPng` takes that
path; `probe-capture-barrier.ts` measures it against the other capture paths.
Capture mechanics: [FIGURE_CAPTURE.md](FIGURE_CAPTURE.md).

## Declined — don't re-propose

- **`preserveDrawingBuffer` as a fix**: refuted. One control arm failed more
  canvas2d tests than webgl, and canvas2d has no drawing buffer. As a one-run
  diagnostic (an `evaluateOnNewDocument` override of `getContext`) it would make
  the webgl self-report conclusive.
- **Compositor double-rAF**: inconclusive (within-arm spread exceeded the
  effect) and cost ~1.7 s per capture in plain headless. The
  `IntersectionObserver` barrier is a different, one-frame mechanism.
- **Re-taking the screenshot inside the same page**: produced "Node is detached
  from document" errors. The whole-test retry shares no page or browser.
- **Whole-suite A/Bs against capture flakiness**: failure counts swing 0–20
  between identical runs. Instrument the failing path instead.
- **`fullPage` screenshots**: never reintroduce.
- **Ink-scoped drift in place of `diffFraction`**: a broken ellipse stroke
  measured 47x under the default, and dividing by inked pixels raises the
  antialiasing floor with the signal, buying at most ~2.4x. What counts as ink
  then sets the threshold. `includeAA: true` nets ~1.06x for the same reason. A
  run-length statistic (stroke-into-dots drops mean horizontal ink-run length
  by an order of magnitude) survived a first look, but only scoped to the
  display canvas; `probe-bar-top-aa.ts` encodes the idea.
- **A `Math.round` ↔ shader `floor(x + 0.5)` pairing sweep**: run once, found
  nothing. `MISLEADING_BUILTINS` refuses `round()` in a shader; a hand-paired
  snap written later is unchecked. The sweep is `Math.round` over canvas code
  against `floor(.*+ 0\.5)` over `*.slang`; the pairing matters, not either
  half.

## Traps

- **The gate is blind to a bug both backends share.** Goldens are the other
  half, and they refresh only by hand. A scene with no `snapshots.lock` entry
  passes as "Snapshot created" without comparing anything, which is the state
  of the `Mark Display` scenes.
- **Being under the threshold is not agreement.** A pair at 1.99% under a 10%
  ceiling hid a real outline bug.
- **A percentage cannot say what differs — decode the pixels.**
  `probe-linked-diff.ts` reports differing colour pairs and their scanlines.
- **Check that a pair was compared before reading meaning into it**, including
  which pairs are missing. A stable drift percentage is not a stable failure: a
  blank-vs-rendered capture is a fixed diff.
- **A render fix that improves agreement stales the goldens of whichever backend
  moved**, and a plain run still passes because webgl keeps the caller's looser
  threshold. The cheap check is the other backend's golden:
  `compare-backends.ts` diffs stored goldens with no browser. A fresh capture
  sits within a fraction of a percent of its counterpart; a stale golden sits
  percents away. Refreshing is its own scoped job (`--exact --filter`) on a
  quiet machine, since a degraded capture pushed as a golden is worse than a
  stale one.
- **A hand-written canvas twin of a shader can disagree at .5 ties.** JS
  `Math.round(4.5)` is 5; GLSL `round()` at .5 is implementation-defined. Both
  sides spell a snap `floor(x + 0.5)`. ADR-051's codegen covers generated twins,
  not paired ones.

## The rasterizer test needs `--real-gpu`

Headless Chrome without `--swiftshader` still renders on SwiftShader, so "render
it again without the flag" compares SwiftShader with itself and every pair
agrees for a reason unrelated to rendering. Measured with `probe-renderer.ts`
(`UNMASKED_RENDERER_WEBGL`):

| launch | renderer |
| --- | --- |
| no flags (runner without `--swiftshader`) | SwiftShader |
| `--use-gl=swiftshader` (runner `--swiftshader`) | SwiftShader |
| `--use-gl=angle` (runner `--real-gpu`) | the real GPU |
| `--disable-gpu` (the canvas2d backend) | SwiftShader |

`runner.ts --real-gpu` makes the comparison real without `--headed`. Pair it
with `--drift-report`, which prints every pair.

## Threshold overrides: an override is a claim, and claims are testable

`THRESHOLD_OVERRIDES` raises the ceiling for snapshot names matching a
substring. Every entry claims a reason two backends disagree, and an
antialiasing claim predicts the drift moves when the rasterizer changes. Render
the same build under `--swiftshader` and `--real-gpu`:

- **identical to two decimals** — not rasterization. The backends draw different
  pixels and the ceiling is hiding a bug.
- **moves** — rasterization, and the entry does its job.

An entry needs a measured number from both runs and a reason that survives the
test; each entry's reason sits beside it in the code. Re-run the audit after any
change to a shared draw path. A stale override is worse than none: the arcs
entries once claimed a curve floor the arcs no longer had, leaving those views
free to regress silently. An override whose pair falls under the default is
deleted, not lowered, and an override for drift nobody intends to fix is not an
override — record the finding here instead, as the per-base wall does.

`inversion-pbsim` is the worked example: its "edge shimmer" ceiling measured
identical across rasterizers and was hiding two bugs — canvas2d anchored its
minimum-width expansion at the left edge where the shader's `expandMinWidthX`
centres it, and both backends resolved a mid-pixel `TRIANGLE_H` edge
differently. What remains (accumulate-vs-resolve on unsnappable sub-pixel marks)
moves with the rasterizer.

`thresholdFor` takes the first substring match, so a specific entry sits above a
broader one. `grep -c 'match:'` overcounts by one: the declaration's type
annotation matches.

### What the gate cannot see: geometry on an already-antialiased edge

`comparePngBuffers` (`pngDiff.ts`) calls pixelmatch with the default
`includeAA: false`, for goldens and the gate alike. On an aliased edge a 1 px
move is fully visible — `antialiased()` disqualifies a pixel with more than two
identical neighbours. On an edge already carrying an AA gradient the moved
pixels read as antialiasing and drop out: removing the GWAS bars'
`BAR_OVERDRAW_PX` moved 387 px by plain RGB compare and 2 at the gate's
settings. So the gate is blind to small geometry wherever the mark is
antialiased, which includes every analytic-coverage mark. Measure such a change
directly, with pixelmatch over two captures or `probe-bar-top-aa.ts`.

**A shade-only change will not rebaseline under `-u`.** Geometry and both
neighbours stay put, so pixelmatch classifies every changed pixel as AA, the
suite passes, and `-u` never fires. Delete the `.png` and let the run write a
fresh one.

### The read outline

Canvas2D and the shader draw the read outline as one rule: `READ_OUTLINE_*`
`export-consts`ed from `read.slang`, placed inside the glyph by
`strokeRectInside` for rects and by `traceReadArrow`'s inset for the chevron.
A centred stroke puts half its width in the 1 px gap between pileup rows, which
smudges neighbouring reads into one band; the gap column, not the drift
percentage, is the check. `READ_OUTLINE_SHADE` matches the ink the older 0.5 px
canvas stroke laid down.

## The per-base wall: measured, and deliberately not gated

`perBaseQuality` and `perBaseLetter` disagree across backends, and no scene
covers them: neither mode is a common setting, and an override that never comes
down is the meaningless ceiling the audit deletes.

<!-- BEGIN GENERATED MEASUREMENT per-base-cross-backend-drift -->

_Generated by `pnpm autogen` — edit the source, not this block._

| scene                      | bp/px | binBp | drift, swiftshader |  real GPU |
| -------------------------- | ----: | ----: | -----------------: | --------: |
| perBaseLetter              |  37.9 |    16 |          **16.39** | **16.40** |
| perBaseLetter              |   3.2 |     1 |              15.63 |     15.63 |
| perBaseLetter              |   0.8 |     1 |               3.40 |      3.40 |
| perBaseQuality             |  37.9 |    16 |               1.76 |      1.76 |
| perBaseQuality             |   3.2 |     1 |               0.42 |      0.42 |
| perBaseQuality             |   0.8 |     1 |               0.14 |      0.14 |
| colour-by normal (control) |  37.9 |     1 |               0.36 |      0.35 |

<!-- END GENERATED MEASUREMENT per-base-cross-backend-drift -->

The figures do not move between rasterizers, so the backends draw different
pixels. Two deliberate asymmetries cause it:

- **`pileupCellX`** (`alignmentsUniforms.slang`) snaps a cell's left edge to a
  pixel column, then extends to a 1 CSS px minimum.
- **`pileupCellWidth`** (`rendererTypes.ts`) leaves the left edge fractional
  and adds `PILEUP_CELL_SEAM_FUDGE_PX` to close Canvas2D's hairlines between
  abutting cells.

Above 1 bp/px the snap dominates: adjacent bases share a column, the GPU keeps
one, and about one column per read stays white that Canvas2D paints. Below
1 bp/px the fudge dominates. Lettering shows it because Canvas2D's overlapping
cells average four widely separated base hues; quality's narrow ramp hides it.
Colour purity: [PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md).

The measurement record's `source.repro` holds the recipe. Per-base becoming a
mode people leave on would reopen it; SVG export takes the Canvas2D path, so an
exported figure differs from the GPU screen it came from. The variant matrix's
`drawnCellHeightPx` floor fixed a ROW-axis priority problem and does not
transfer to these columns.

## Synteny's drift is the sub-pixel fade, and it is curve-only

At whole-genome zoom every ribbon takes the thin path, a ~1 px band whose alpha
carries its true width. The GPU measures that width per fragment from the local
perpendicular (`perpCoverage`); Canvas2D measures it once per ribbon off the
chord (`ribbonPerpWidth`). The two agree on a straight ribbon and differ along a
bezier's ends; `probe-synteny-backend-drift.ts` and `probe-synteny-thin-fade.ts`
separate them. `ribbonMaxPerpWidth` split the fill-vs-stroke decision off the
chord, which brought the pair under the default.

**Do not "fix" it on the GPU side**: the local width is the honest one, and the
Canvas2D fix (N strokes at N alphas per ribbon) lands inside the loop
`StyleCache` exists to keep fast. Parked in
[ideas/collections/synteny-comparative.md](../ideas/collections/synteny-comparative.md).
A zoomed synteny override would catch nothing: the gate counts pixels, so a
handful of wrong ribbons rounds to zero.

The rasterizer rule is weaker here. These shaders compute coverage analytically
and Canvas2D is Skia either way, so a synteny pair can be rasterizer-stable and
still antialiasing-shaped; vary the drawing (`drawCurves`, `autoDiagonalize`)
to prove the cause.

## Alignments under webgpu: it was the harness

Webgpu drift on the alignments suites was the capture, not the render:
`el.screenshot()` scrolled an inner container in Firefox and composited the app
header into the canvas rectangle. `captureElementPng` clips to the measured rect
instead ([FIGURE_CAPTURE.md](FIGURE_CAPTURE.md), "`el.screenshot()` scrolls the element first";
`probe-webgpu-coverage.ts`). No override was added, and none should be for a
harness artifact.

Alignments suites earlier needed retries under load (`Navigating frame was
detached`, the worker pool dying together on first attempts), which is why the
heavy suites (CRAM, simulated long reads) stay out of the blocking job.

### Widening the gate scripts

`pnpm test:browser:gate` renders webgpu; `:gate:ci` keeps `--skip-webgpu`
because the CI runner lacks Firefox Nightly, a display and a WebGPU adapter.
[ideas/waiting-on-someone-else/render-webgpu-in-the-blocking-cross-backend-gate-job.md](../ideas/waiting-on-someone-else/render-webgpu-in-the-blocking-cross-backend-gate-job.md)
holds that work.

## The AA ramp prediction outlived its instrument

The `aaSmoothRamp` → `aaRamp` conversions predicted their pairs would move down
the drift distribution. Gate runs kept dying, and by the time one could finish
every watched site (dotplot, wiggle line, synteny, multi-way, GWAS) had been
redrawn for unrelated reasons, so the prediction was closed unfalsified with no
number. A before/after against a recorded distribution reads only while its
sites hold still: re-pose it across one commit pair on a site nothing else is
touching.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  and [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) — the other parity
  mechanism. Codegen makes sub-visual drift impossible; this gate catches
  visible drift. A pixel threshold cannot see a constant moving from 0.4 to
  0.45.
