---
name: cross-backend-gate
description: The canvas2d-vs-GPU render gate that blocks CI — what is in its scope and why, the measured drift distribution behind the 1.5% threshold, the measured baselines to check an alignments render change against, and the methodology that made it blockable (a threshold override is a testable claim, tested with --real-gpu since omitting --swiftshader does not give you one; a whole-suite A/B cannot resolve an effect this size). Read before widening CI_GATE_SUITES, changing the threshold, adding an override, or re-opening the blank-capture question.
audience: internal
---

# The cross-backend render gate

`crossBackendGate.ts` diffs the canvas2d and GPU renders of the same run, so it
is a correctness oracle needing no golden. It ran non-blocking until 2026-07-16
and was removed (`f3cb3b962b`) because a check nobody reads is decoration.

**It is back, blocking, since 2026-08-04.** `cross_backend_gate` in `push.yml`
runs `pnpm test:browser:gate:ci` — `--ci-gate`, which scopes to `CI_GATE_SUITES`
and forces remote data off, under swiftshader; ~2.5 min of rendering after the
build.

## What made a blocking gate possible

1. **A scope whose noise floor is nowhere near the threshold.** 66 pairs per run,
   0 over threshold, worst *passing* drift 0.51% against a then-3% default. The
   drift comparison was never the problem — it has been clean for the
   deterministic view types across every measurement.

   **The default is 1.5% since 2026-08-11**, because that headroom was measured
   rather than spent. Re-measured on the CI scope with `--drift-report`: 66
   pairs, **max 0.62%**, median 0.00%, exactly one pair over 0.5% and none over
   1% — byte-identical across two consecutive runs, which is the property that
   makes a tight threshold safe rather than merely tighter. 1.5% is ~2.4x the
   worst case. Deliberately not 1%: this gate was once switched off for being
   noisy, and on a blocking job margin is worth more than tightness.

   The number to check a change against is that distribution, not the max alone.
   The worst pair has moved 0.51% → 0.62% since August and is
   `targeted_bigwig-multibigwig-multirowline`; the top four are all wiggle line
   plots, and all of them move between rasterizers, so that floor is genuine
   antialiasing.

   **What 1.5% costs, measured: a loaded full hand run can now flag a pair that
   is fine.** `pnpm test:browser:gate` over all 310 tests, on a run that
   degraded badly (23 failures, 29 uncompared, 132 pairs instead of 157), put
   `dotplot-default` at 1.88% / 1.68%. Re-run scoped to `Dotplot View` it is
   **0.06% / 0.04%**, which is what all three `--ci-gate` runs also measured. So
   it is the documented capture degradation — a partial capture is a *fixed*
   diff, so the magnitude looks stable while the occurrence stays racy — and not
   a rendering difference. At 3% that noise sat under the ceiling; at 1.5% it
   surfaces.
   
   This does not reach the blocking job: CI runs `--ci-gate` (106 tests, and
   `retries` defaults to 1 there against 0 for a hand run), and dotplot was
   0.06% in every one. **If a heavy full run flags something, re-run it scoped
   before believing it** — that is the same instruction the load section below
   already gives, now with a threshold that will actually make you follow it.
2. **The gate can no longer pass by checking less.** An uncompared pair is a
   failure under `--ci-gate`.
3. **A blank capture fails its test and takes one retry, in a fresh browser,
   reported by name** — same path on both sides of every pair.

## The blank captures are the CAPTURE, not the render

Every wait in `waitForCaptureSettled` swallows its timeout, so each is re-checked
afterwards and the verdict goes into the failure message. **34 of 34 blanks read
"all capture waits settled"; zero were attributed to a wait that expired**, on
both backends. No amount of additional waiting fixes that, so the README's old
"idle machine" precondition was treating a symptom. The decisive self-report:

```
[self-report: canvas 1193x529 HAS content (19442b) while the screenshot is blank
              -> capture/compositing side]
```

**Do not turn those bytes into the capture.** It was implemented and reverted in
one session on its own evidence: a recovered `targeted_variants-assembly-aliases`
came back **93.65% different** from the other backend's screenshot of the same
view, every glyph in an identical place over a wholly different background.
`toDataURL` does not flatten alpha and does not see DOM drawn over the canvas;
`el.screenshot()` composites both. The drawings agree, the capture paths do not,
and **a differential oracle must not compare one backend's backing store against
another's composited layers** — a false 93% drift is far worse for a blocking
gate than a re-run. `assertCanvasHasContent` is the one place the backing store
stays authoritative, because it asks "did the display draw" and compares no bytes.

The retry is a different mechanism from the one reverted in `28c6ee6d90`, which
re-took the screenshot inside the same page and produced nine "Node is detached
from document" errors. A whole-test re-run shares no handle, no page, no browser.

**Half the blank verdicts are still unreadable, and the split is perfectly
clean:** canvas2d blanks self-report "HAS content" and are conclusive; webgl
blanks self-report "ALSO blank", which is not, because a cleared drawing buffer
reads identically. So every blank that *can* be attributed points at the capture
path, and every webgl one tells you nothing.

That paragraph was true here and false in the failure message for as long as
both existed. `canvasSelfReport` spelled the webgl branch `-> render side` and
`assertNonBlank` closed with "usually means a shader/upload regression", so the
one artifact a reader actually meets named the half this section rules out —
a conclusion no input could have changed, since the branch is the only one a
WebGL canvas reaches. Both strings carry the finding now, and
`probe-canvas-selfreport.ts` prints the two notes side by side on a page that is
demonstrably rendering: run it before trusting any future readback verdict.

**There is now one wait that does move the number, and it is not an app-level
one.** Every wait this section rules out asks the *app* whether it has finished;
an `IntersectionObserver` callback is queued from inside update-the-rendering, so
awaiting one asks the *browser* whether it has produced a frame. Measured on one
settled canvas2d page with `browser-tests/probe-capture-barrier.ts`, alternating
three capture paths: `el.screenshot` 3/15 then 0/25 blank, a bare clip 5/15 then
6/25, and a clip behind that barrier **0/15 and 0/25**. `captureElementPng` takes
the third path. That is a measurement on one page and one backend, not a claim
that the blank captures are closed — but it is the first thing tried against them
that separated from its controls, and the two arms above did not.

The durable capture-side mechanics are in
[SCREENSHOT_CAPTURE_RACE.md](SCREENSHOT_CAPTURE_RACE.md).

## Do not re-derive

- **`preserveDrawingBuffer` as a FIX: tested, REFUTED.** Interleaved A/B/A/B on
  one build; no improvement, treatment arm worse at comparable load (15 failures
  vs 9). The result that kills the whole WebGL framing: one control arm failed
  **7 canvas2d tests against 2 webgl**, and canvas2d has no drawing buffer to
  clear. Refuted *as a fix* only — as a **diagnostic** it is still open and would
  make webgl's self-report conclusive, via an `evaluateOnNewDocument` override of
  `getContext`. That is one deliberate run, not another A/B, and do not leave it
  on.
- **Compositor double-rAF: tested, INCONCLUSIVE, not in the tree.** Blanks went
  5 → 4 while within-arm spread (1 vs 7) exceeded the between-arm difference. It
  was verified active first (58 ms under swiftshader, 1670 ms in plain headless),
  and 1.67 s × ~160 captures is why it was reverted rather than kept. **The
  `IntersectionObserver` barrier in `captureElementPng` is a different animal and
  is in the tree**: it costs one frame rather than two whole rAF round trips, it
  was measured per capture path on one page rather than by whole-suite failure
  counts, and it separated cleanly (0/25 against 6/25). Don't read this bullet as
  covering it.
- **A whole-suite A/B cannot resolve an effect of this size.** Failure counts
  ranged 0–20 per run under nominally identical conditions. **Stop running
  whole-suite A/Bs against this** — instrument the failing path instead, which is
  what finally worked every time.
- **Baseline any change to this suite against HEAD on the same filter, and
  compare failure MODES, not just totals.** The reverted pair above had an
  identical failure *count* to its control and was still a regression: a
  diagnosable mix became nine opaque puppeteer internal errors.
- **`fullPage` is already fixed and is not this.** Never reintroduce it.
- **The gate is blind to a bug both backends share.** It would have caught
  neither render bug found on 2026-07-16. Goldens are the other half, and they
  only refresh by hand.
- **`EXCLUDED_SUBSTRINGS` is empty.** Scoping is `--ci-gate` / `--filter`.
- **A stable drift percentage does not mean a stable failure.**
  `fullpage_methylation_snapshot` came in at exactly 37.98% in two runs hours
  apart and passed under 3% in a third — a blank-vs-rendered capture is a *fixed*
  diff, so the magnitude reproduces while the occurrence stays racy. Check
  whether the pair was compared at all before inferring determinism.

## The rasterizer test needs `--real-gpu`, and did not have it

**Omitting `--swiftshader` does not give you the real GPU when running headless,
and that is how the rasterizer test was described.** Measured 2026-08-11 with
`browser-tests/probe-renderer.ts`, reading `UNMASKED_RENDERER_WEBGL` on a box
with two discrete GPUs:

| launch | renderer |
| --- | --- |
| no flags (runner *without* `--swiftshader`) | SwiftShader |
| `--use-gl=swiftshader` (runner `--swiftshader`) | SwiftShader |
| `--use-gl=angle` (runner `--real-gpu`) | Intel UHD Graphics 630 |
| `--disable-gpu` (the canvas2d backend) | SwiftShader |

So "render it twice, once with `--swiftshader` and once on the real GPU" run
headless is SwiftShader against SwiftShader, every figure agrees to two decimals
for a reason that has nothing to do with rendering, and the audit's decision rule
— *identical ⇒ not antialiasing ⇒ something is drawn differently* — fires on
every row. **A check that passes by proving nothing**, which is this file's own
recurring complaint pointed at itself.

`runner.ts --real-gpu` pushes `--use-gl=angle` and makes the comparison real
without needing `--headed` (which also forces concurrency 1 and a display). Use
`--drift-report` with it to print every pair rather than the worst five; the
previous recipe was to zero every threshold, which also writes a diff PNG per
pair and exits non-zero.

This does **not** retract the `inversion-pbsim` result below. Those two bugs were
confirmed by reading the code and by measured improvements (16.71 → 7.32 → 6.59),
which no flag can fake. What is unknown is whether that audit's rasterizer test
was itself real; re-run it with `--real-gpu` before relying on the *method*
again.

## `alignments-long-reads-sv-linked`: 1.99%, and it is the read outline

> **Corrected 2026-08-11, same day.** This section first attributed the drift to
> the linked-read connector width, on the strength of the `-linked` suffix and a
> real width bug found in that pass. **That was wrong**, and the way it was wrong
> is the useful part: the `-linked` correlation was a naming coincidence, and the
> supporting evidence had a hole in it — `targeted_inversion-pbsim` was
> *uncompared* in the run I read the rasterizer test off, so "only the `-linked`
> views fail to move" was drawn from a gap in the data rather than from the data.
> Its figure is 3.94%, identical to `inversion-pbsim-linked`'s, which says the
> connectors contribute ~nothing.
>
> Two lessons worth more than the fix: **check whether a pair was compared at all
> before reading meaning into which pairs are missing** (this file already says
> that about determinism and it applies to attribution too), and **a percentage
> cannot tell you what differs — decode the pixels.** `probe-linked-diff.ts` gave
> the answer in one run after an afternoon of plausible reasoning had not.
>
> The connector width bug below is real and is fixed; it is just worth ~0.02pp,
> not 1.99pp.

Found by re-running the audit properly (2026-08-11, swiftshader vs `--real-gpu`,
same build):

| pair | swiftshader | real GPU | verdict |
| --- | --- | --- | --- |
| `targeted_alignments-long-reads-sv-linked` | 1.99% | **1.99%** | does not move |
| `fullpage_alignments-long-reads-sv-linked` | 0.62% | **0.62%** | does not move |
| `targeted_color-by-insert-size-orientation` | 0.70% | 0.68% | moves |
| `targeted_alignments-volvox-sv` | 0.64% | 0.56% | moves |
| `targeted_bigwig-multibigwig-multirowline` | 0.62% | 0.61% | moves |
| `targeted_additional-line-wiggle` | 0.41% | 0.23% | moves |
| `fullpage_additional-color-wiggle` | 0.08% | 0.04% | moves |

These pairs do not move between rasterizers where their neighbours do. **That
much held**; what it meant did not.

**The cause is the read outline.** `probe-linked-diff.ts` decodes the two
captures and reports the differing colour pairs and their scanlines, which
settles in one run what the percentage cannot say at all. A vertical slice
through the hottest row, at a column inside a read:

| y | canvas2d | webgl | |
| --- | --- | --- | --- |
| 194 | (236,139,139) | (236,139,139) | read fill, agrees |
| 195 | (218,128,128) | (165, 97, 97) | read edge scanline |
| 196 | (219,219,219) | (255,255,255) | the inter-row **gap** |
| 197 | (218,128,128) | (165, 97, 97) | read edge scanline |

Canvas2D's 1 px outline is centred on the rect boundary, so half of it lands
outside the glyph: a lighter edge (218 against 165) and grey bled into a gap the
GPU leaves white. The shader draws its outline inside the glyph. A systematic
half-pixel stroke-placement difference — which is exactly why no rasterizer
moves it.

**The controlled comparison is already in the suite.** `showOutline` defaults to
`isChainMode`, and `isChainMode` is `linkedReads === 'normal'`:

| snapshot | `linkedReads` | outline | drift |
| --- | --- | --- | --- |
| `alignments-long-reads-sv-linked` | `'normal'` | on | **1.99%** |
| `alignments-long-reads-sv-zoomed-out` | unset | off | **0.02%** |

Same track, same locus, one setting apart, 100x the drift.

Note what this also means: in chain mode `showLinkedReadLines` is
`showBezierConnections && !isChainMode`, so the linked-read connector pass does
not run in this view at all. The horizontal connectors visible in the capture are
`connLine`, which has been a proper quad all along.

This pair was one of the **seven overrides deleted on 2026-08-05** for measuring
1.99% against a 10% ceiling. Deleting it was right — the ceiling was
meaningless — but "it is under the default" was read as "it is fine", and the
rasterizer test that would have separated those two claims was not run on it.
**Being under the threshold is not evidence of agreement.**

### Fixed: the outline is one rule now, and the override is gone

`read.slang` `export-consts`es `READ_OUTLINE_PX` / `READ_OUTLINE_SHADE` /
`READ_OUTLINE_MIN_PX`, and `features/read/drawCanvas.ts` reads all three. The
placement rule is `strokeRectInside` in `canvas2dUtils` — stroke inside the rect,
never straddling it — which `plugins/canvas` had open-coded as `+0.5` and is now
the one spelling both painters use.

**1.99% → 0.75%**, so the pair sits under the 1.5% default and its threshold
override was **deleted rather than lowered**, which is what an override reaching
zero should look like.

Worth keeping the shape of the bug: only the *colour* had agreed, and by
coincidence — compositing black at `1 - s` over a fill is arithmetically
`fill * s`, so one rule had been written once as a composite and once as a
multiply. The three things that had *not* agreed were placement (boundary vs
inner band), width (0.5 vs 1 px) and the gate (Canvas2D tested width only, so a
2 px row outlined where the GPU did not).

Unifying them settled on the GPU's `0.7`, and that was the wrong half of the
disagreement to keep. It was never chosen against the canvas's number; the two
were written apart and compared only on colour. A 0.5 px stroke at alpha 0.3 is
0.15 px·alpha of ink per edge, and a 1 px band at 0.3 is twice that — so
adopting 0.7 everywhere doubled the outline's weight as a side effect of
deduplicating it. `READ_OUTLINE_SHADE` is **0.85** now, which is the same ink the
canvas spelling laid down, all of it inside the glyph.

The **0.75%** left after that was the same concept one level down, and is now
also done: the chevron arrowhead's outline was a centred stroke on a polygon on
the canvas side against a distance-to-the-two-diagonals test on the GPU. It is
worth recording that the residue was the *worse* half of the two, because it is
the half a gate percentage does not describe. Converting the rect branch and not
the pentagon left the pentagon stroking its fill path at the new, doubled
`READ_OUTLINE_PX` — still centred, so half of a line twice as wide now landed
outside the read, in the 1 px gap between pileup rows. One pixel column down a
chain-mode read stack at featureHeight 7, fill `#d3d3d3`:

| | edge row | the gap between rows |
| --- | --- | --- |
| the 0.5 px centred spelling | 194 | 217 |
| after the rect-half fix | 177, 182 | **185** |
| inside the glyph, at shade 0.7 | 148 | **255** |
| inside the glyph, at shade 0.85 | **180** | **255** |

A darkened gap is two neighbouring reads smudged into one soft band, which is
visible as a blurrier pileup long before 0.75% sounds like anything. The last two
rows are the same geometry and differ only in weight; the gap column is what the
fix bought, and it is why the lighter shade does not bring the haze back with it.

Insetting an arbitrary polygon is not the one-liner insetting a rect is, but it
is not the two-fill rewrite this note previously assumed either: the polygon
offset of a home plate is two closed-form terms off the apex half-angle (see
`traceReadArrow`), and it keeps the single `fillStyle` per read that the two-fill
version would have spent twice — which is the per-read cost the read painter is
built around.

**A shade change will not rebaseline under `-u`.** Changing only the outline's
value leaves its geometry and both its neighbours (the fill and the background)
exactly where they were, which is the signature pixelmatch uses to classify a
pixel as anti-aliasing — and jest-image-snapshot runs it with the default
`includeAA: false`, so every changed pixel is skipped and the suite passes
against a stale golden. 0.7 → 0.85 moves 9,211 pixels and reports 0. Delete the
`.png` and let the run write a fresh one; `-u` never fires because nothing
failed. It also means the golden is not the check here — the pixel column is.

### The connector width bug, which is real and is not this

Found on the way, fixed, and worth about 0.02pp. `linkedReads/packGpu.ts`
declared `topology: 'line-list'`, and a GPU line list is 1 px wide whatever you
ask for — WebGPU has no line-width parameter at all and WebGL2 requires only
1.0 — while `features/linkedReads/drawCanvas.ts` strokes `ctx.lineWidth = 1.5`.
The pass is a 6-vertex quad now, extruded along the segment's own frame because a
linked-read connector is diagonal, with the same box SDF and `STROKE_AA_PX` ramp
`arcFlat.slang` uses; the width is `LINKED_READ_LINE_WIDTH_PX`, `export-consts`ed
so both sides read one value. That was the third and last native line in the
plugin.

It only ever affected **bezier** mode (`inversion-pbsim-linked`,
`inversion-simple-bam-linked`), which is why it moved so little: connectors are a
handful of pixels against a full pileup. `targeted_inversion-pbsim` and
`targeted_inversion-pbsim-linked` measure the same 3.94%, and that equality is
the cleanest statement of how little the connectors contribute.

## Threshold overrides: an override is a claim, and claims are testable

The list held eight entries and was audited down to **one** on 2026-08-05, the
seven deleted ones measuring 0.00–2.22% against ceilings of 5–10%. **The audit
method is at the top of `THRESHOLD_OVERRIDES`; re-run it after any change to a
shared draw path, and never add an entry without a measured number.**

It rose to **four** on 2026-08-11 as tightening the default to 1.5% exposed
entries rather than loosening any: two `-linked` entries recording the line-width
bug above (3.96% and 1.99%, neither moving between rasterizers), and
`inversion-paired-coverage` at 2.40%/2.31% — the first entry in this list whose
antialiasing claim the audit has ever *confirmed* rather than refuted. Splitting
`inversion-pbsim-linked` out also stopped the 10% coverage ceiling silently
covering a second, unrelated bug.

**It is two now.** Both `-linked` entries went when the read outline was fixed on
both sides. Two per-base entries arrived and left again inside a day, which is
its own worked example of the rule at the top of this section — see "The
per-base wall" below.

**Order matters now, and did not before.** `thresholdFor` takes the first
substring match, so `inversion-pbsim-linked` has to sit above `inversion-pbsim`
or it is swallowed by it. Latent while there was one entry.

(If you count them with `grep -c 'match:'` you get one more than there are,
because it counts the type annotation on the declaration line. That is the exact
miscount the entry warns about.)

The survivor, `inversion-pbsim`, is the worked example of why this matters. Its
comment blamed "uniform edge shimmer over identically-shaped reads" — an
antialiasing claim, which predicts the number moves when the rasterizer changes.
It did not:

| | real GPU | swiftshader |
| --- | --- | --- |
| `targeted_inversion-pbsim-coverage` | 16.71% | 16.71% |
| `targeted_inversion-pbsim` | 7.97% | 7.97% |
| `targeted_inversion-paired-coverage` | 5.49% | 5.49% |
| `fullpage_inversion-pbsim` | 2.30% | 2.30% |

The same figures to two decimals across two completely different rasterizers. AA
noise cannot survive swapping the rasterizer; a systematic difference in *what is
drawn* can. **It was hiding two real bugs**, both now fixed:

- `ba14fd5669` — canvas2d anchored its sub-pixel minimum-width expansion at the
  mark's LEFT edge while the shader's `expandMinWidthX` centers it, so every
  coverage mark past 1bp/px sat half a pixel right of the GPU's. Centering the
  three canvas call sites took the worst pair **16.71% → 7.32%**. Eight canvas2d
  goldens moved, all in Long Reads and Inversions — no other view is zoomed out
  far enough for the clamp to fire.
- `990648d3c6` — `TRIANGLE_H` is 4.5, so the interbase bar's edges landed
  mid-pixel on *both* backends, and they resolve a half-covered row differently:
  canvas2d composites ~40 overlapping 1px bars per column separately and
  saturates to opaque, the GPU resolves the union coverage once and correctly
  stays at exactly 50%. Snapping both edges to whole pixels took **7.32% →
  6.59%**.

**That fix's first attempt made things worse (7.69%), and the reason
generalizes: `Math.round(4.5)` is 5 in JS, but GLSL's `round()` at exactly .5 is
implementation-defined and rounds down.** Snapping "the same" number on both
sides moved the bar a pixel apart. Both use `floor(x + 0.5)` now. Every
hand-written canvas twin of a shader has this available to it, and ADR-051's
codegen does not cover them — it covers generated twins, not paired ones.

The remaining 6.59% is the same accumulate-vs-resolve asymmetry on marks that
**cannot** be snapped: SNP ticks and indicator triangles at arbitrary sub-pixel
x, ~40 deep per column. Canvas2D is the wrong one — drawing the same opaque shape
twice should not make it more opaque — but closing it means canvas2d drawing one
merged mark per pixel column instead of 40 overlapping antialiased ones, which is
a change to the drawing model rather than an offset fix. Left deliberately: the
override is at 10% with the gap understood rather than mysterious.

### The `Math.round` pairing is swept, and clean

**Swept 2026-08-11 — don't re-run it, extend it.** Every `Math.round` in every
file that draws to a canvas, against every shader-side `floor(x + 0.5)`: no
pairing. What is left is color quantization, dpr scaling (`devicePxSpan`,
`backingPx` — shared by both backends by construction, which is the point of
those helpers), and two row-centre midpoints,
`LinearMafRenderer/rendering/emptyLines.ts` and
`LinearMultiRowFeatureDisplay/rendering/drawMultiRowIndelGlyphs.ts`, on paths that
have no GPU pass at all. A clean sweep is worth recording precisely because it
leaves nothing behind to look at: the next reader of the paragraph above would
otherwise do it again.

The sweep is two greps and it is the *pairing* that matters, not either half:

```sh
grep -rn 'Math\.round' --include='*.ts' --include='*.tsx' packages plugins   # canvas side
grep -rn 'floor(.*+ 0\.5)' --include='*.slang' packages plugins              # shader side
```

Note what this does and does not buy. It closes the ties case for *this*
spelling; the codegen closes it structurally wherever a decision is exported
(`MISLEADING_BUILTINS` refuses `round()` in a shader outright, with the reason).
The residue is a hand-paired snap someone writes tomorrow, and nothing checks for
that — the sweep is a point-in-time measurement, not a gate. It was not made one
for the same reason the override list is kept short: a check whose findings are
all "no" teaches people to skip it.

## The per-base wall: measured, and deliberately not gated

`perBaseQuality` and `perBaseLetter` draw a cell per aligned base of every read —
the densest thing the pileup paints — and no cross-backend check covered either
at any zoom. Two scenes were added on 2026-08-27 to close that, and **both failed
on their first run** against a disagreement older than the scenes.

**They are not in the tree.** The scenes and the two overrides holding them came
back out the same day, on the decision that the disagreement is not worth fixing:
neither mode is a common setting, and an override is supposed to be a record of
something someone intends to fix. An 18% ceiling that is never coming down is the
meaningless ceiling this file's own audit deleted seven of, and the 1.6pp of
headroom it left over a 16.39% pair was catching nothing short of a catastrophe.
Better to keep the finding and drop the apparatus.

So this section is the record. **Read it before adding a scene back** — the work
is done, and re-covering the mode costs a gate run rather than a day.

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

**The rasterizer column is the verdict.** Every targeted pair reads the same to
two decimals under SwiftShader and on a real GPU, which antialiasing cannot do —
so the two backends are drawing different pixels, the way `inversion-pbsim` does
and unlike `inversion-paired-coverage`.

Two deliberate asymmetries produce it, both still in the tree and both documented
where they live:

- **`pileupCellX`** (`alignmentsUniforms.slang`) snaps a cell's left edge to a
  pixel column, then extends to a 1 CSS px minimum from that anchor.
- **`makePileupCellMapper`** (`rendererTypes.ts`) leaves the left edge fractional
  and draws `max(1, 1/bpPerPx) + PILEUP_CELL_SEAM_FUDGE_PX`, the half pixel that
  closes Canvas2D's AA hairlines between abutting cells.

Above 1 bp/px the snap dominates: adjacent bases land in one column, the GPU
keeps one of them, and **10,553 one-pixel columns stay white that Canvas2D
paints** — about one per read. That set is *identical* in both colour modes,
which is what makes it geometry rather than colour. Below 1 bp/px the fudge
dominates instead, drawing a 1.77px cell where the GPU draws 1.27px.

**Lettering is where it shows, and quality is why nobody saw it.** Decoding the
pixels rather than the percentage: Canvas2D's overlapping cells average to exact
two-colour means — `249,108,27` where the GPU writes red `244,67,54`, and
`53,162,162` where it writes blue `33,150,243`. Four widely separated base hues
make that legible; `perBaseQuality`'s narrow ramp reports roughly the same value
either way, which is why it stays under the default until the bin widens the
composite and then only reaches 1.76%. The same asymmetry, one palette apart.
The colour-purity half of that is in
[PER_BASE_SUBPIXEL_BIN.md](PER_BASE_SUBPIXEL_BIN.md), where it also bounds that
doc's own account of the mechanism.

### To see it again

Two `lgvSnapshotTest` scenes on `volvox_alignments` at `ctgA:1..48,000` with
`displaySnapshot.colorBy.type` of `perBaseLetter` and `perBaseQuality`, in any
suite; then

```sh
node browser-tests/runner.ts --filter=<suite> --backend=all \
  --skip-webgpu --swiftshader --gate-only --drift-report
```

Pick the zoom deliberately. `subPixelBinBp` returns 1 below 4 bp/px, so a scene
under that zoom says nothing about the bin — though as the table shows it still
fails, because the bin was never what caused this.

**What would reopen it:** per-base becoming a mode people leave on. Note the
SVG export takes the Canvas2D path, so an exported figure is the other backend's
answer than the screen it was exported from.

**The variant matrix shared that complaint and was fixed, and it does not
transfer here.** Its Canvas2D painter took `drawnCellHeightPx`'s floor, because
that display orders cells ref-then-nonref so a variant paints over the reference
background, and at 0.09px rows a variant drawn `rowHeight + f2` tall blended
back into the grey — the export kept 41% of the strongly-coloured variant pixels
the screen showed, and drift fell from 18.2% to 14.4%. **That was the ROW axis.**
The wall above is columns, the matrix's own columns were deliberately left
fractional in the same change, and the argument for the floor was a priority
rule between two cell classes that per-base colouring does not have. So the
matrix's answer is evidence about rows and says nothing about this.

## Synteny's one drifting pair is the sub-pixel fade, and it is curve-only

`targeted_hs1-mm39-synteny-clean-ribbon` is the only synteny pair that has ever
been over threshold — 1.58% against the 1.5% default, the same figure under
swiftshader and on a real GPU. Every other synteny pair in the suite sits at
0.00-0.02%, including `grape-peach-synteny-clean-ribbon`, whose view spec is
identical field for field.

**It is the two sub-pixel fade models disagreeing, and only where the ribbon
curves.** Whole-genome hs1/mm39 is 2.23 Mbp/px, so a 500kb alignment is 0.22px
wide and every ribbon in the frame takes the thin path: a ~1px band whose alpha
carries how much of a pixel it really covers. The GPU measures that width per
fragment from the local perpendicular (`perpCoverage`); Canvas2D measures it once
per ribbon off the centerline chord (`ribbonPerpWidth`). On a straight ribbon
those are one number. On the bezier they are not — `sBlendDeriv/yCurveDeriv` is 0
at both ends and 2.0 at the middle, so a rearranged block is at its *widest*
perpendicular where it meets the frame and its thinnest halfway down, and a
single per-ribbon number cannot say that. The diff image is red along the arcs at
the top and bottom edges for exactly that reason.

Three runs, each varying one thing (`probe-synteny-backend-drift.ts`):

| view | `drawCurves` | straight |
| --- | --- | --- |
| hs1/mm39, diagonalized (what the suite renders) | 1.54% | 0.53% |
| hs1/mm39, `autoDiagonalize: false` — steeper, same data and count | **1.72%** | **0.44%** |
| grape/peach, same settings | 0.00% | 0.01% |

Turning curves off at identical data and ribbon count takes three quarters of it.
Making the ribbons steeper moves the two modes in **opposite** directions, which
is the discriminating result: worse curved, better straight, because steeper
drives both models further below `WIDTH_FADE_FLOOR` (0.15) where they agree
again. That floor is also why grape/peach is immune at any slope — its 2kb
alignments are 0.006px and both models are pinned to the floor.

`probe-synteny-thin-fade.ts` is the two models side by side with no browser at
all: 1.42-1.47x apart at a rearranged ribbon's ends in curve mode, 1.00x in
straight mode, 1.00x for grape/peach.

**Do not "fix" this on the GPU side.** The local width is the more honest
statement of what a pixel row covers; Canvas2D is the approximation, and it is
the fallback backend. Closing it there means stroking the centerline in N pieces
at N alphas rather than one `ctx.stroke()`, inside the loop `StyleCache` exists
because `rgba()` construction alone cost >100ms at 500k instances. Filed in
TODO.md and given a 2% override with the gap understood.

**One caveat this pair exposes about the audit rule.** "Identical across
rasterizers ⇒ not antialiasing ⇒ a real difference in what is drawn" was derived
from alignments. It is weaker here: these shaders compute coverage analytically
rather than leaning on the rasterizer, and the canvas2d side is Skia either way,
so a synteny pair can be rasterizer-stable and still be an antialiasing-shaped
difference. The rule pointed at the right answer this time; it did not prove it —
the `drawCurves` and `autoDiagonalize` arms did.

## Alignments vs webgl: the historical drift does not reproduce

The exclusion rested on a 2026-07 record of over-threshold pileup drift.
Re-measured 2026-08-04 under swiftshader after the composed capture waits: **0
over threshold in all six runs** (`Alignments Track` + `Color Schemes` at loads
4.9/8.6/10.2, and the whole pileup family at 8.7/30.8/35.1). Alignments drift
2.01% / 0.93% / 0.87%.

What replaces it is a *stability* difference, not a correctness one, and it
tracks machine load rather than anything in the app: the heavy suites (CRAM,
simulated long reads) needed 2–11 retries per run, and their failures arrive as
`Navigating frame was detached` in simultaneous batches of four — the whole
concurrency-4 worker pool dying together. Every one hit a *first* attempt, so the
retry is the remedy and not the cause. At load 35 one run finished with 6
uncompared pairs, all "only canvas2d": coverage degrades with load while the
verdict stays clean, which is exactly what the uncompared-is-a-failure rule
exists to make visible, and the reason to keep the heavy suites out of a blocking
job.

## The webgl goldens went stale behind those fixes; refreshed 2026-08-16

Every fix above moved the GPU render toward canvas2d and none of them refreshed a
webgl golden, because the gate needs no golden and the goldens only refresh by
hand. Twenty of them had drifted, up to **10.77%**, on a tree nobody had touched
— and a plain run reports "19 passed", since webgl keeps the caller's loose
threshold and the full-page ones pass at 10%. Only `--update-snapshots` shows it.

**The cheap check is the OTHER backend's golden**, and it separates a stale
golden from this suite's documented capture race in one read with no second run.
Every stale webgl golden sat 1.08–10.77% from its canvas2d counterpart while
every fresh capture landed within 0.25%, most within 0.05% and
`fullpage_alignments-bam` at 0.00%. Two backends do not race the same way by
accident, and a swiftshader-vs-real-GPU difference cannot bring a webgl capture
to 0.00% of a software golden — so it was neither of the two things it looked
like.

The gate on that scope afterwards: **26 pairs, 0 over threshold, worst 0.71%**
(`targeted_color-by-insert-size-orientation`), with
`targeted_alignments-long-reads-sv-linked` — the 1.99% pair this file is largely
about — no longer in the top five. A second `-u` run rewrote nothing, which is
what says the new goldens are stable rather than a captured race.

So: **a render fix that improves cross-backend agreement leaves the goldens of
whichever backend moved reading as a regression.** The gate going green is not
the end of the change.

### The synteny scope was NOT in that refresh, and still is not

"Refreshed 2026-08-16" is the alignments scope only. Re-measured 2026-08-19 with
`compare-backends.ts`, which diffs the STORED goldens with no browser and no
build, the synteny webgl set is 30-67% from its canvas2d counterpart while the
same views agree to 1.58% live:

| | stored golden | live gate |
| --- | --- | --- |
| `targeted_grape-peach-synteny-clean-ribbon` | 67.05% | **0.00%** |
| `targeted_hs1-mm39-synteny-clean-ribbon` | 55.74% | 1.58% |
| `targeted_hs1-mm39-synteny-chr1-large` | 42.91% | 0.02% |
| `targeted_hs1-mm39-synteny-wholegenome` | 36.58% | 0.62% |

That gap IS the staleness test from the section above, run the other way round.
`targeted_multiway-dotplot-grape-peach-zoomed` is a second tell — its stored
goldens do not agree on a pixel size, which no render can cause. The sizes sit
beside each path in `snapshots.lock`; quoting them here would only date the
sentence to the last refresh, which is what happened to the pair this once read.
The picture itself is nearly empty — gridlines and one alignment — so a drift
percentage over this pair says little; the size disagreement is the whole
signal.

A shader change to this scope therefore moves goldens that were already wrong by
three orders of magnitude more than the change: the straight-mode quad fix
(`2992682961`) moved live webgl output about 0.03%, against 30-67% of standing
staleness. **Refreshing is its own scoped job, not a step in a synteny render
change**, and the machine has to be quiet for it — these are the remote suites,
and a capture degraded under load pushed as a golden is worse than a stale one.
`--exact --filter`, never bare.

## Alignments under webgpu: was 8 of 40 pairs over threshold, and it was the harness

`test:browser:gate` and `:gate:ci` both passed `--skip-webgpu`, so webgpu pairs
were in no measurement here until 2026-08-08, and what that first measurement
found was eight stable failures: 3-4% on the targeted alignments captures and
15-27% on the full-page ones, reproducing to the decimal across a from-scratch
baseline build at `82ac1951f6` and every later run.

**It was the capture, not the render, and it is fixed as of 2026-08-26.**
`el.screenshot()` scrolls the element into view first; Firefox scrolled an inner
container by 73px where Chrome did not; the canvas top then sat under the app
header and the capture composited 37px of locstring box, toolbar divs and ruler
into the canvas rectangle. `captureElementPng` measures the rect and clips to it
instead, and asserts the rect across the capture. Mechanism, the numbers either
side, and two things the fix turned up that the attribution did not predict:
[SCREENSHOT_CAPTURE_RACE.md](SCREENSHOT_CAPTURE_RACE.md), "The third one".
`browser-tests/probe-webgpu-coverage.ts` prints both capture paths in one run.

Re-measured on the two suites, `--backend=all --swiftshader --gate-only
--drift-report`, same build either side of the change:

| pair (canvas2d vs webgpu) | before | after |
| --- | --- | --- |
| `fullpage_color-by-strand` | 27.01% | 0.48% |
| `fullpage_color-by-tag-hp` | 24.21% | 0.49% |
| `fullpage_color-by-mapping-quality` | 23.13% | 0.48% |
| `fullpage_alignments-bam` | 15.01% | 0.91% |
| `targeted_color-by-strand` | 3.88% | 0.08% |
| `targeted_color-by-mapping-quality` | 3.88% | 0.07% |
| `targeted_color-by-tag-hp` | 3.51% | 0.01% |
| `targeted_alignments-bam` | 3.47% | 0.01% |

40 pairs, **8 over threshold before and 0 after**, max 0.91%, median 0.08%. The
control that makes it a fix rather than a coincidence: every canvas2d-vs-webgl
figure in the same two runs is unchanged to the decimal — 0.70 / 0.62 / 0.23 /
0.21 / 0.14 / 0.07 — because Chrome was never scrolling, so its captures did not
move.

**No threshold override was added and none should be**, which was the pressure
this section existed to resist: the number would have excused a harness artifact
as a rendering difference, and `inversion-pbsim` above is this project's own
record of what that costs. Three separate correlations also pointed at the wrong
subsystem — it looked like a coverage-strip bug (the band is where the coverage
strip is), a zoom-dependent one (a zoomed-in locus stacks more pileup rows, so
the display is taller and Firefox decides a scroll is needed) and a WebGPU one
(only that backend runs in Firefox). The band held at 37px whether
`coverageHeight` was 45 or 90, which is what ruled the first one out.

`alignments-pileup-coverage` was never part of this: its one hot row is hot under
webgl too, so it is shared, and it measures 0.09% / 0.07% now.

**`Alignments Track` and `Alignments Color Schemes` were safe in `CI_GATE_SUITES`
only because CI ran `--skip-webgpu`.** That is no longer the reason they are
safe; the drift is gone on its own.

### Widening the gate scripts: the drift half is done, the CI half is not

`test:browser:gate` — the hand run — drops `--skip-webgpu` as of 2026-08-26.
**`test:browser:gate:ci` does not, and the blocker is the runner, not the
pixels.** `cross_backend_gate` in `push.yml` runs on `ubuntu-latest`, and the
webgpu backend is the only one that is not Chrome:

- it needs Firefox Nightly at `/usr/bin/firefox-nightly`
  (`FIREFOX_NIGHTLY_PATH` / `--firefox=` override it), which neither the workflow
  nor `.github/actions/setup` installs;
- `runWithRenderingBackend` launches it with `headless: false` deliberately, so
  the job would also need a virtual display;
- and a GPU-less runner has no WebGPU adapter, where `--swiftshader` only ever
  spoke for Chrome's WebGL.

None of that is checkable from a worktree, and landing an unverifiable change to
a blocking job is worse than a job that renders two backends. So the CI half is
its own piece of work: provision Firefox Nightly plus a display plus a software
WebGPU adapter in the job, prove it on a branch, then drop the flag there too.

## Two cheap habits this thread paid for

- **When a wait expires, report what state the thing is actually in**, rather
  than an opaque timeout. That single move settled the blank captures after nine
  rounds of statistics had not.
- **Check `git status` before dating a baseline off the log.** The delta under
  test was entirely uncommitted, so `HEAD` already *was* the pre-change tree and
  there was no sha to hunt for. A from-scratch baseline worktree costs about 20
  minutes, most of it the install (which is required — symlinking `node_modules`
  recompiles the modified sources).

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  and [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) — the *other* parity
  mechanism. Codegen makes sub-visual drift impossible; this gate catches visible
  drift. Neither subsumes the other, and a 3% pixel threshold cannot see a
  constant moving from 0.4 to 0.45.
