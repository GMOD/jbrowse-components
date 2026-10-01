---
name: cross-backend-gate
description: What does the blocking canvas2d-vs-GPU render gate cover, what can it not see, and how is a threshold override tested? Read before widening CI_GATE_SUITES or adding an override.
audience: internal
kind: operations
---

# The cross-backend render gate

`crossBackendGate.ts` diffs the canvas2d and GPU renders of the same run, so it
is a correctness oracle needing no golden. The `cross_backend_gate` job in
`push.yml` runs `pnpm test:browser:gate:ci` (`--ci-gate`): it scopes to
`CI_GATE_SUITES`, forces remote data off and renders under swiftshader. The job
blocks, because a check nobody reads is decoration.

- **The scope's noise floor sits far below the threshold.** `DEFAULT_THRESHOLD`
  leaves deliberate margin over the worst pair, because this gate was once
  switched off for being noisy. Re-measure with `--ci-gate --drift-report` and
  compare the whole distribution, not the max alone.
- **The gate cannot pass by checking less.** An uncompared pair fails under
  `--ci-gate`, and the runner fails if a `CI_GATE_SUITES` name matches no suite.
- **A blank capture fails its test and retries once in a fresh browser.**

**If a heavy full hand run flags a pair, re-run it scoped before believing it.**
A loaded `pnpm test:browser:gate` degrades captures, and a partial capture is a
fixed diff.

## The blank captures are the CAPTURE, not the render

Blank captures report all waits settled, so more app-level waiting does not fix
them. A webgl self-report of "ALSO blank" proves nothing, since a cleared drawing
buffer reads identically (`canvasSelfReport`, `probe-canvas-selfreport.ts`).

**Do not turn the canvas bytes into the capture.** `toDataURL` neither flattens
alpha nor sees DOM drawn over the canvas, while `el.screenshot()` composites
both; a recovered capture compared against the other backend's screenshot came
back 93% different. `assertCanvasHasContent` is the one place the backing store
stays authoritative, because it compares no bytes.

The one wait that moves the blank rate is a browser-frame barrier:
`captureElementPng` awaits an `IntersectionObserver` callback, which is queued
from update-the-rendering. Capture mechanics: [FIGURE_CAPTURE.md](FIGURE_CAPTURE.md).

## Declined — don't re-propose

- **`preserveDrawingBuffer` as a fix**: refuted; canvas2d has no drawing buffer
  and a control arm failed more canvas2d tests than webgl.
- **Compositor double-rAF**: inconclusive and ~1.7 s per capture.
- **Re-taking the screenshot inside the same page**: "Node is detached from
  document". The whole-test retry shares no page or browser.
- **Whole-suite A/Bs against capture flakiness**: failure counts swing 0-20
  between identical runs. Instrument the failing path.
- **`fullPage` screenshots**: never reintroduce.
- **Ink-scoped drift in place of `diffFraction`**: dividing by inked pixels
  raises the antialiasing floor with the signal, buying at most ~2.4x, and what
  counts as ink then sets the threshold. `includeAA: true` nets ~1.06x.
- **A `Math.round` / shader `floor(x + 0.5)` pairing sweep**: found nothing.
  `MISLEADING_BUILTINS` refuses `round()` in a shader; a hand-paired snap written
  later is unchecked.

## Traps

- **The gate is blind to a bug both backends share.** A scene with no
  `snapshots.lock` entry passes as "Snapshot created" without comparing
  anything, which is the state of the `Mark Display` scenes.
- **Being under the threshold is not agreement.** A pair at 1.99% under a 10%
  ceiling hid a real outline bug.
- **A percentage cannot say what differs.** `probe-linked-diff.ts` reports
  differing colour pairs and their scanlines.
- **Check that a pair was compared**, including which pairs are missing. A
  blank-vs-rendered capture is a fixed diff.
- **A render fix that improves agreement stales the goldens of whichever backend
  moved**, and a plain run still passes because webgl keeps the caller's looser
  threshold. `compare-backends.ts` diffs stored goldens with no browser: a stale
  golden sits percents from its counterpart. Refresh with `--exact --filter` on a
  quiet machine, since a degraded capture pushed as a golden is worse than a
  stale one.
- **A hand-written canvas twin of a shader can disagree at .5 ties.** JS
  `Math.round(4.5)` is 5; GLSL `round()` at .5 is implementation-defined. Both
  sides spell a snap `floor(x + 0.5)`. ADR-051's codegen covers generated twins,
  not paired ones.
- **The read outline is one rule on both backends** (`READ_OUTLINE_*` from
  `read.slang`, drawn inside the glyph): a centred stroke smudges neighbouring
  reads across the 1 px gap between pileup rows. The gap column is the check.

## The rasterizer test needs `--real-gpu`

Headless Chrome without `--swiftshader` still renders on SwiftShader, and so does
`--disable-gpu` (the canvas2d backend), so "render it again without the flag"
compares SwiftShader with itself. `runner.ts --real-gpu` (`--use-gl=angle`) makes
the comparison real without `--headed`; `probe-renderer.ts` prints
`UNMASKED_RENDERER_WEBGL`. Pair it with `--drift-report`.

## Threshold overrides: an override is a claim, and claims are testable

`THRESHOLD_OVERRIDES` raises the ceiling for snapshot names matching a substring,
each with its reason beside it in the code. An antialiasing claim predicts the
drift moves when the rasterizer changes. Render the same build under
`--swiftshader` and `--real-gpu`:

- **identical to two decimals**: not rasterization. The backends draw different
  pixels and the ceiling is hiding a bug (`inversion-pbsim` hid two).
- **moves**: rasterization, and the entry does its job.

An entry needs a measured number from both runs. Re-run the audit after any
change to a shared draw path. A stale override is worse than none. An override
whose pair falls under the default is deleted, not lowered, and an override for
drift nobody intends to fix is not an override: record the finding here instead,
as the per-base wall does. `thresholdFor` takes the first substring match, so a
specific entry sits above a broader one.

### What the gate cannot see: geometry on an already-antialiased edge

`comparePngBuffers` (`pngDiff.ts`) calls pixelmatch with `includeAA: false`. On
an edge already carrying an AA gradient, moved pixels read as antialiasing and
drop out: removing the GWAS bars' `BAR_OVERDRAW_PX` moved 387 px by plain RGB
compare and 2 at the gate's settings. The gate is blind to small geometry on
every analytic-coverage mark. Measure such a change with pixelmatch over two
captures or `probe-bar-top-aa.ts`.

**A shade-only change will not rebaseline under `-u`**: pixelmatch classifies
every changed pixel as AA, the suite passes, and `-u` never fires. Delete the
`.png` and let the run write a fresh one.

## The per-base wall: measured, and deliberately not gated

`perBaseQuality` and `perBaseLetter` disagree across backends, and no scene
covers them: an override that never comes down is the meaningless ceiling the
audit deletes.

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
pixels. Two deliberate asymmetries cause it: `pileupCellX`
(`alignmentsUniforms.slang`) snaps a cell's left edge to a pixel column, while
`pileupCellWidth` (`rendererTypes.ts`) leaves it fractional and adds
`PILEUP_CELL_SEAM_FUDGE_PX` to close Canvas2D's hairlines. Above 1 bp/px the snap
dominates; below it the fudge does. Colour purity:
[PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md).

The measurement record's `source.repro` holds the recipe. Per-base becoming a
mode people leave on would reopen it; SVG export takes the Canvas2D path, so an
exported figure differs from the GPU screen it came from. The variant matrix's
`drawnCellHeightPx` floor fixed a ROW-axis problem and does not transfer.

## Synteny's drift is the sub-pixel fade, and it is curve-only

At whole-genome zoom every ribbon takes the thin path, a ~1 px band whose alpha
carries its true width. The GPU measures that width per fragment
(`perpCoverage`); Canvas2D once per ribbon off the chord (`ribbonPerpWidth`), so
they differ along a bezier's ends. `probe-synteny-backend-drift.ts` and
`probe-synteny-thin-fade.ts` separate them.

**Do not "fix" it on the GPU side**: the local width is the honest one, and the
Canvas2D fix (N strokes at N alphas per ribbon) lands inside the loop
`StyleCache` keeps fast. Parked in
[ideas/collections/synteny-comparative.md](../ideas/collections/synteny-comparative.md).
A zoomed synteny override would catch nothing, since the gate counts pixels. A
synteny pair can be rasterizer-stable and still antialiasing-shaped; vary the
drawing (`drawCurves`, `autoDiagonalize`) to prove the cause.

## Alignments under webgpu: it was the harness

Webgpu drift on the alignments suites was the capture: `el.screenshot()` scrolled
an inner container in Firefox and composited the app header into the canvas
rectangle. `captureElementPng` clips to the measured rect
([FIGURE_CAPTURE.md](FIGURE_CAPTURE.md), "`el.screenshot()` scrolls the element first").
Add no override for a harness artifact. The heavy suites (CRAM, simulated long
reads) stay out of the blocking job because they need retries under load.

`pnpm test:browser:gate` renders webgpu; `:gate:ci` keeps `--skip-webgpu`
because the CI runner lacks Firefox Nightly, a display and a WebGPU adapter.
[ideas/waiting-on-someone-else/render-webgpu-in-the-blocking-cross-backend-gate-job.md](../ideas/waiting-on-someone-else/render-webgpu-in-the-blocking-cross-backend-gate-job.md)
holds that work.

## The AA ramp prediction outlived its instrument

The `aaSmoothRamp` to `aaRamp` conversions predicted their pairs would move down
the drift distribution. Every watched site was redrawn for unrelated reasons
before a gate run could finish, so the prediction closed unfalsified. A
before/after against a recorded distribution reads only while its sites hold
still: re-pose it across one commit pair on a site nothing else is touching.

## Related

[ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
and [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md): codegen makes sub-visual drift
impossible; this gate catches visible drift. A pixel threshold cannot see a
constant moving from 0.4 to 0.45.
