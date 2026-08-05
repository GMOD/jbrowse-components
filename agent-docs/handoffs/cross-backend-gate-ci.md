---
name: cross-backend-gate-ci
description: The cross-backend render gate is back in CI as of 2026-08-04, blocking, scoped to CI_GATE_SUITES under swiftshader — what landed and why that scope, the blank-capture verdict that unblocked it (capture side, not render side), and what is still out of the gate (alignments, and the timeout failure mode). Read before widening the scope or re-opening the blank/timeout investigation.
---

# Cross-backend render gate → CI

`crossBackendGate.ts` diffs the canvas2d and webgl renders of the same run, so it
is a correctness oracle needing no golden. It ran non-blocking until 2026-07-16
and was removed (`f3cb3b962b`) because a check nobody reads is decoration.

**It is back, blocking, as of 2026-08-04.** `cross_backend_gate` in `push.yml`
runs `pnpm test:browser:gate:ci` — `--ci-gate`, which scopes to `CI_GATE_SUITES`
and forces remote data off, under swiftshader. ~2.5 min of rendering after the
build. This file is now about what is *not* in it.

## What made a blocking gate possible

Three things, in the order they mattered:

1. **A scope whose noise floor is nowhere near the threshold.** 66 pairs per run,
   0 over threshold, worst *passing* drift 0.51% against a 3% default. The drift
   comparison was never the problem — it has been clean for the deterministic
   view types across every measurement in this file's history.
2. **The gate can no longer pass by checking less** (below).
3. **The blank-capture verdict**, which turned the dominant failure mode from an
   unexplained flake into a known one with a bounded remedy (below).

### Measurements (2026-08-04, swiftshader, one build, load 3-9)

| Run | tests | pairs | over threshold | uncompared | exit | note |
| --- | --- | --- | --- | --- | --- | --- |
| `--filter` A | 104 / 2 | 62 | 0 | 4 | 1 | 2 blank captures |
| `--filter` B | 105 / 1 | 64 | 0 | 2 | 1 | 1 blank capture |
| `--ci-gate` A | 106 / 0 | 66 | 0 | 0 | 0 | |
| `--ci-gate` B | 106 / 0 | 66 | **1** | 0 | 1 | the substitution's false drift — removed |
| `--ci-gate` C | 106 / 0 | 66 | 0 | 0 | 0 | 1 blank, retried |
| **final 1** | **106 / 0** | **66** | **0** | **0** | **0** | |
| **final 2** | **106 / 0** | **66** | **0** | **0** | **0** | |
| **final 3** | **106 / 0** | **66** | **0** | **0** | **0** | 1 blank, retried |

Three consecutive clean runs in the CI invocation, ~2 min each. The two
`--filter` failures were blank captures, not drift, and no run in the whole set
produced a *real* over-threshold pair.

Top passing drifts were **byte-identical in all eight runs** (0.51 / 0.41 / 0.38
/ 0.38 / 0.29), the same bit-stability the earlier full-suite runs showed:
**deterministic renders really are deterministic**, which is what makes a
0-false-positive gate possible at all.

## Blocker 1: the gate loses coverage silently — FIXED

A failed test produces no capture, and a snapshot captured by only one backend is
**skipped, not failed**. One run reported "0 over threshold" while comparing 19
fewer pairs than the next — it passed by checking less.

`compareImages` calls `recordCapture` **before** its `gate-only` early return, so
a stale golden costs the gate nothing, and in gate-only mode every failure still
standing is one that happened *before* the screenshot. Each of those, and only
those, removes a pair. So `--gate-only` no longer ignores `totalFailed`, the gate
returns `skippedNames` (a bare count cannot distinguish a structural skip from
one that timed out this run), and **under `--ci-gate` an uncompared pair fails
the run** — every structurally single-backend case (`gpu-quirks`' context-loss
test) is outside `CI_GATE_SUITES`, so within that list there is no legitimate
reason for a snapshot to reach only one backend.

A fourth guard is on the suite list itself: a name in `CI_GATE_SUITES` matching
no discovered suite **fails the run**. A renamed suite silently dropping out of a
green CI job is the same failure mode wearing a different hat.

## Blocker 2: `waitForMorphIdle` is vacuous for alignments — FIXED

`morphFromTops` is declared only in `plugins/canvas`
`LinearBasicDisplay/baseModel.ts`, so the predicate reads `undefined == null` →
true on the first poll for exactly the displays that flake. This is the third
place that overclaim appeared; **grep `morphFromTops` before crediting that wait
with anything.**

Fixed by composing waits that already existed: `snapshot.ts` has one
`waitForCaptureSettled` running overlay-gone → phases → displays-done →
morph-idle, in that order because each is blind to what the next sees.
`waitForDisplaysDone` alone would not have done it — it keys on `canvasDrawn`,
which is *first paint* and flips on a partially-filled canvas.

## The blank captures: SETTLED — it is the capture, not the render

Every wait in `waitForCaptureSettled` swallows its timeout, so each is now
re-checked afterwards and the verdict goes into the failure message. **34 of 34
blanks read "all capture waits settled"; zero were attributed to a wait that
expired**, on both backends — and every blank seen since, in the `--ci-gate`
measurements below, read the same way. No amount of additional waiting can fix
that, so the README's old "idle machine" precondition was treating a symptom.

The question was then asked directly rather than statistically: `el.screenshot()`
serves *composited* layers, `canvas.toDataURL()` reads the backing store. Both
verdicts have now been observed, and the decisive one is:

```
[self-report: canvas 1193x529 HAS content (19442b) while the screenshot is blank
              -> capture/compositing side]
```

### Using those bytes as the capture: TRIED, MEASURED, REVERTED

The obvious follow-on — they are demonstrably the render, so make them the
capture — was implemented and reverted within the same session, on its own
evidence. A recovered `targeted_variants-assembly-aliases` came back **93.65%
different** from the other backend's screenshot of the same view, with every
glyph in an identical place over a wholly different background: `toDataURL` does
not flatten alpha and does not see DOM drawn over the canvas, while
`el.screenshot()` composites both. The drawings agree; the capture paths do not.

**A differential oracle must not compare one backend's backing store against
another's composited layers**, and a false 93% drift is far worse for a blocking
gate than a re-run. So a blank capture fails its test, and `--ci-gate` takes
**one retry per test, in a fresh browser, reported by name** — same path on both
sides. `assertCanvasHasContent` is the one place the backing store stays
authoritative, because it asks "did the display draw" and compares no bytes.

The retry is a different mechanism from the one reverted in `28c6ee6d90`, which
re-took the screenshot inside the same page and produced nine "Node is detached
from document" errors: a whole-test re-run shares no handle, no page, no browser.
It was exercised in validation run 3 — one webgl blank, retried, run clean at
full coverage (66 pairs).

**A "render side" verdict on webgl is not conclusive** (a cleared drawing buffer
reads identically); on canvas2d it is. The durable half of all this now lives in
[reference/SCREENSHOT_CAPTURE_RACE.md](../reference/SCREENSHOT_CAPTURE_RACE.md).

### Which is why half the verdicts are still unreadable

Six blanks across the eight runs above, and the split is perfectly clean:

| backend | verdict | conclusive? |
| --- | --- | --- |
| canvas2d × 3 | HAS content → **capture side** | yes |
| webgl × 3 | "ALSO blank" | **no** — cleared drawing buffer reads the same |

So every blank that *can* be attributed points at the capture path, and every
webgl one tells you nothing. That is the useful reading of `preserveDrawingBuffer`
below: it is refuted **as a fix**, and untested **as a diagnostic**. Turning it on
temporarily makes webgl's self-report conclusive, and the harness patch to do it
(an `evaluateOnNewDocument` override of `getContext`, verified against a plain
canvas first) is already described in the refuted experiment. That is one
deliberate run, not another A/B — and do not leave it on, for the reason in that
same entry.

## Do not re-derive

- **`preserveDrawingBuffer` as a FIX: tested, REFUTED.** Interleaved A/B/A/B on
  one build; no improvement, treatment arm worse at comparable load (15 failures
  vs 9). The result that kills the whole WebGL framing: one control arm failed
  **7 canvas2d tests against 2 webgl**, and canvas2d has no drawing buffer to
  clear. (Refuted as a fix only — see above for the diagnostic use, which is
  still open.)
- **Compositor double-rAF: tested, INCONCLUSIVE, not in the tree.** Blanks went
  5 → 4 while within-arm spread (1 vs 7) exceeded the between-arm difference. It
  was verified active first (58 ms under swiftshader, 1670 ms in plain headless),
  and 1.67 s × ~160 captures is why it was reverted rather than kept.
- **A whole-suite A/B cannot resolve an effect of this size.** Failure counts
  ranged 0-20 per run under nominally identical conditions. **Stop running
  whole-suite A/Bs against this**; instrument the failing path instead, which is
  what finally worked.
- **Baseline any change to this suite against HEAD on the same filter, and
  compare failure MODES, not just totals.** Two scalps: the reverted pair had an
  identical failure *count* to its control and was still a regression (a
  diagnosable mix became nine opaque puppeteer internal errors).
- **`fullPage` is already fixed and is not this.** Never reintroduce it.
- **The gate is blind to a bug both backends share.** It would have caught
  neither render bug found on 2026-07-16. Goldens are the other half, and they
  only refresh by hand.
- **Threshold overrides are where the gate is told not to look — and the list is
  now audited down to one.** It held eight entries (not nine: this file said
  nine, and the `grep -c 'match:'` it recommended returns nine because it counts
  the type annotation on the declaration line — the exact miscount it was warning
  about). Seven were deleted on 2026-08-05, measuring 0.00–2.22% against ceilings
  of 5–10%. Only `inversion-pbsim` survives. **The audit method is written at the
  top of `THRESHOLD_OVERRIDES`; re-run it after any change to a shared draw
  path**, and never add an entry without a measured number.
- **`EXCLUDED_SUBSTRINGS` is empty.** Scoping is `--ci-gate` / `--filter`.
- **A stable drift percentage does not mean a stable failure.**
  `fullpage_methylation_snapshot` came in at exactly 37.98% in two runs hours
  apart and passed under 3% in a third — a blank-vs-rendered capture is a *fixed*
  diff, so the magnitude reproduces while the occurrence stays racy. Check
  whether the pair was compared at all before inferring determinism.

## The pbsim override is NOT antialiasing noise — measured

The `inversion-pbsim` entry raises the gate's ceiling to 20% and
`targeted_inversion-pbsim-coverage` has sat at 16.71% under it in every run for
months. The override comment blamed "uniform edge shimmer over identically-shaped
reads". **That explanation is refuted.** The four drifts were

| | real GPU (2026-08-04) | swiftshader (2026-08-04) |
| --- | --- | --- |
| `targeted_inversion-pbsim-coverage` | 16.71% | 16.71% |
| `targeted_inversion-pbsim` | 7.97% | 7.97% |
| `targeted_inversion-paired-coverage` | 5.49% | 5.49% |
| `fullpage_inversion-pbsim` | 2.30% | 2.30% |

— the same figures to two decimals across **two completely different
rasterizers**. AA/MSAA noise cannot survive swapping the rasterizer; a systematic
difference in *what is drawn* can.

**Audited, and it was hiding two real bugs.** One is fixed (`ba14fd5669`):
canvas2d anchored its sub-pixel minimum-width expansion at the mark's LEFT edge
while the shader's `expandMinWidthX` centers it, so every coverage mark past
1bp/px sat half a pixel right of the GPU's. Centering the three canvas call sites
took the worst pair **16.71% → 7.32%** and halved the differing pixels; the
override came down 20% → 10%. Eight canvas2d goldens moved, all in Long Reads and
Inversions — no other view is zoomed out far enough for the clamp to fire.

The second is also fixed (`990648d3c6`), for a smaller gain: `TRIANGLE_H` is 4.5,
so the interbase bar's edges landed mid-pixel on *both* backends, and they
resolve a half-covered row differently — canvas2d composites ~40 overlapping 1px
bars per column separately and saturates to opaque, the GPU resolves the union
coverage once and correctly stays at exactly 50%. Snapping both edges to whole
pixels took **7.32% → 6.59%**.

**That fix's first attempt made things worse (7.69%), and the reason generalizes:
`Math.round(4.5)` is 5 in JS, but GLSL's `round()` at exactly .5 is
implementation-defined and rounded down.** Snapping "the same" number on both
sides moved the bar a pixel apart. Both use `floor(x + 0.5)` now. Every
hand-written canvas twin of a shader has this available to it, and ADR-051's
codegen does not cover them — it covers generated twins, not paired ones.

### What is left, and why it stops here

The remaining 6.59% is the same accumulate-vs-resolve asymmetry on marks that
**cannot** be snapped: SNP ticks and indicator triangles sit at arbitrary
sub-pixel x, ~40 deep per column at this zoom. Canvas2D is the wrong one —
drawing the same opaque shape twice should not make it more opaque — but closing
it means canvas2d drawing one merged mark per pixel column instead of 40
overlapping antialiased ones. That is a change to the drawing model, not an
offset fix, and it was left deliberately: 16.71% → 6.59% with the override at 10%
is enough headroom, and the remaining gap is understood rather than mysterious.

The method is the transferable part: **a threshold override is a claim about why
two backends disagree, and claims are testable.** This one said "antialiasing",
which predicts the number moves when the rasterizer changes. It didn't.

## Alignments: re-measured, and the drift is gone

The exclusion rested on a 2026-07 record of over-threshold pileup drift. Measured
again on 2026-08-04 under swiftshader, after the composed capture waits:

| Scope | run | load | tests | pairs | over threshold | uncompared | retries |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Alignments Track` + `Color Schemes` | 1 | 4.9 | 26 / 0 | 20 | **0** | 0 | 1 |
| | 2 | 8.6 | 26 / 0 | 20 | **0** | 0 | 0 |
| | 3 | 10.2 | 26 / 0 | 20 | **0** | 0 | 0 |
| whole pileup family¹ | 1 | 8.7 | 79 / 1 | 60 | **0** | 2 | 11 |
| | 2 | 30.8 | 80 / 0 | 62 | **0** | 0 | 2 |
| | 3 | 35.1 | 77 / 3 | 56 | **0** | 6 | 5 |

¹ alignments, breakpoint split view, methylation, long-reads-inversions,
multi-region sort, session-spec, main-thread RPC. Alignments drift: 2.01% (under
a 10% override), 0.93%, 0.87%.

**The historical pileup drift does not reproduce — 0 over threshold in all six
runs.** What replaces it is a *stability* difference, not a correctness one, and
it tracks machine load rather than anything in the app: the heavy suites (CRAM,
simulated long reads) needed 2-11 retries per run, and their failures arrive as
`Navigating frame was detached` in simultaneous batches of four — the whole
concurrency-4 worker pool dying together, once with a literal "Failed to launch
the browser process". Every one of those hit a *first* attempt, so the retry is
the remedy and not the cause.

Note what that costs at load 35: run 3 finished with 6 uncompared pairs, all
"only canvas2d", i.e. the webgl pass lost those browsers. Coverage degrades with
load while the verdict stays clean — which is the exact shape `--ci-gate`'s
uncompared-is-a-failure rule exists to make visible, and its own reason to keep
the heavy suites out of a blocking job.

Recommendation: add **`Alignments Track`** and **`Alignments Color Schemes`**
(tight drift, clean 3/3). Hold `Long Reads and Inversions` until the pbsim
override above is audited — adding it now would buy four pairs whose passing
verdict is a 5-17% divergence the gate is configured to ignore.

## Next, in order

1. **Nothing on the override list.** It was audited to one entry on 2026-08-05
   (see "Do not re-derive"), and `inversion-pbsim` stays at 10% because its
   remaining 6.59% is understood and deliberately not being chased. The audit
   is the thing to repeat, not revisit.
2. **Widen `CI_GATE_SUITES`** with the two alignments suites, then the local
   deterministic ones never measured under swiftshader (arcs, workspaces, redraw,
   cursor-guides, svg-export, custom-url, variant-force-load). Arcs and
   workspaces carry overrides tuned on a real GPU, so measure before adding —
   that is the whole procedure, and it is a measurement, not an edit.
3. **Attribute the TIMEOUT mode.** The other failure mode: a display never
   reports `-done` inside 60 s. Apply exactly the move that worked for blanks —
   when the wait expires, report what state the display is actually in
   (`data-display-phase`, whether the wrapper exists at all, whether an error
   banner is up) instead of an opaque timeout. `waits.ts` already notes the
   likely shape: a display in a terminal `tooLarge`/`renderError` state renders no
   wrapper and so can never report done, which reads as a timeout forever. An
   earlier attempt was reverted (`839113dabe`) — re-query the selector per attempt
   rather than holding the handle, and prove the mechanism on a targeted
   reproduction first.
4. **Make the webgl blank verdict readable** with `preserveDrawingBuffer` as a
   diagnostic (see above). Half the blanks are currently unattributable.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  and [reference/SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md) — the *other*
  parity mechanism. Codegen makes sub-visual drift impossible; this gate catches
  visible drift. Neither subsumes the other, and a 3% pixel threshold cannot see
  a constant moving from 0.4 to 0.45.
- [reference/SCREENSHOT_CAPTURE_RACE.md](../reference/SCREENSHOT_CAPTURE_RACE.md)
  — the two blank-capture mechanisms, and which fix belongs to which.
- `products/jbrowse-web/browser-tests/README.md` — how to run it.
