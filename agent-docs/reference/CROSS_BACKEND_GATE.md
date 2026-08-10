---
name: cross-backend-gate
description: The canvas2d-vs-GPU render gate that blocks CI — what is in its scope and why, the measured baselines to check an alignments render change against, and the methodology that made it blockable (a threshold override is a testable claim; a whole-suite A/B cannot resolve an effect this size). Read before widening CI_GATE_SUITES, adding a threshold override, or re-opening the blank-capture question.
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
   0 over threshold, worst *passing* drift 0.51% against a 3% default. The drift
   comparison was never the problem — it has been clean for the deterministic
   view types across every measurement.
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
  and 1.67 s × ~160 captures is why it was reverted rather than kept.
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

## Threshold overrides: an override is a claim, and claims are testable

The list held eight entries and is audited down to **one**. Seven were deleted on
2026-08-05, measuring 0.00–2.22% against ceilings of 5–10%. **The audit method is
at the top of `THRESHOLD_OVERRIDES`; re-run it after any change to a shared draw
path, and never add an entry without a measured number.**

(If you count them with `grep -c 'match:'` you get nine, because it counts the
type annotation on the declaration line. That is the exact miscount the entry
warns about.)

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

## Alignments under webgpu: 8 of 40 pairs over threshold, and it is the harness

`test:browser:gate` and `:gate:ci` both pass `--skip-webgpu`, so webgpu pairs
were in no measurement here until 2026-08-08. **This table is the number to check
any alignments render change against** — every figure reproduced to the decimal
across a from-scratch baseline build at `82ac1951f6` and two later runs:

| pair (canvas2d vs webgpu) | drift |
| --- | --- |
| `fullpage_color-by-strand` | 26.95% |
| `fullpage_color-by-tag-hp` | 24.39% |
| `fullpage_color-by-mapping-quality` | 23.09% |
| `fullpage_alignments-bam` | 16.38% |
| `targeted_color-by-strand` | 3.88% |
| `targeted_color-by-mapping-quality` | 3.87% |
| `targeted_color-by-tag-hp` | 3.49% |
| `targeted_alignments-bam` | 3.46% |
| `targeted_alignments-long-reads-sv-linked` | 2.00% |
| `fullpage_alignments-long-reads-sv-linked` | 0.93% |
| `targeted_color-by-insert-size-orientation` | 0.68% |

The canvas2d-vs-webgl pairs in the same runs stayed at their usual 1.99 / 0.71 /
0.65 / 0.62 / 0.23, and synteny under the same invocation was 64 pairs / 0 over
threshold.

**The cause is settled and it is the harness, not the render** —
`el.screenshot()` scrolls the element into view first, Firefox scrolls an inner
container by 73px where Chrome does not, the canvas top then sits under the app
header, and the capture composites 37px of locstring box, toolbar divs and ruler
into the canvas rectangle. The backing store held the full coverage strip the
whole time. Written up in [SCREENSHOT_CAPTURE_RACE.md](SCREENSHOT_CAPTURE_RACE.md),
"The third one"; `browser-tests/probe-webgpu-coverage.ts` reproduces all of it in
one run. **Read that before touching this**, because three separate correlations
point at the wrong subsystem: it looks like a coverage-strip bug, a
zoom-dependent bug and a WebGPU bug, and it is none of them.

The split across tests is the locus, downstream of the scroll — a zoomed-in locus
stacks more pileup rows, so the display is taller. `alignments-pileup-coverage`'s
4.69% is a different thing: its one hot row is hot under webgl too, so it is
shared.

**Consequence:** adding `Alignments Track` and `Alignments Color Schemes` to
`CI_GATE_SUITES` is safe **only because CI runs `--skip-webgpu`**. Say that out
loud when adding them, or the next person widening the gate to webgpu gets eight
failures and no context. **Do not add a threshold override to paper over these** —
the number would be excusing a harness artifact as a rendering difference, and
`inversion-pbsim` above is this project's own record of what that costs.

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
