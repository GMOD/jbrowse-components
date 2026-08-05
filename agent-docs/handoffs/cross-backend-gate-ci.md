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

## Do not re-derive

- **`preserveDrawingBuffer`: tested, REFUTED.** Interleaved A/B/A/B on one build;
  no improvement, treatment arm worse at comparable load (15 failures vs 9). The
  result that kills the whole WebGL framing: one control arm failed **7 canvas2d
  tests against 2 webgl**, and canvas2d has no drawing buffer to clear.
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
- **Threshold overrides are where the gate is told not to look.**
  `grep -c 'match:' crossBackendGate.ts` — nine entries, unchanged since
  `333db010c9`. This file said seven for several rounds, so count them rather
  than trusting the number. `targeted_inversion-pbsim-coverage` sits at 16.71%
  under a 20% ceiling in every full-suite run — a real, stable divergence the
  gate is configured to accept. That list wants auditing, not growing.
- **`EXCLUDED_SUBSTRINGS` is empty.** Scoping is `--ci-gate` / `--filter`.
- **A stable drift percentage does not mean a stable failure.**
  `fullpage_methylation_snapshot` came in at exactly 37.98% in two runs hours
  apart and passed under 3% in a third — a blank-vs-rendered capture is a *fixed*
  diff, so the magnitude reproduces while the occurrence stays racy. Check
  whether the pair was compared at all before inferring determinism.

## Next, in order

1. **Widen `CI_GATE_SUITES`.** The list is 12 suites; the remaining local
   deterministic ones (arcs, workspaces, redraw, cursor-guides, svg-export,
   custom-url, variant-force-load) were never measured under swiftshader. Arcs
   and workspaces carry threshold overrides tuned on a real GPU, so measure
   before adding — that is the whole procedure, and it is a measurement, not an
   edit.
2. **Attribute the TIMEOUT mode.** The other failure mode, and now the dominant
   one: a display never reports `-done` inside 60 s. Apply exactly the move that
   worked for blanks — when the wait expires, report what state the display is
   actually in (`data-display-phase`, whether the wrapper exists at all, whether
   an error banner is up) instead of an opaque timeout. `waits.ts` already notes
   the likely shape: a display in a terminal `tooLarge`/`renderError` state
   renders no wrapper and so can never report done, which reads as a timeout
   forever. An earlier attempt at this was reverted (`839113dabe`) — re-query the
   selector per attempt rather than holding the handle, and prove the mechanism
   on a targeted reproduction first.
3. **Alignments.** They are out of the CI scope because every over-threshold
   failure ever recorded here has been an alignments view, and the diff image
   agrees with the structural argument (one backend full width, the other painted
   only the left ~47% — a capture taken mid-paint, not a shader divergence). The
   capture-side fix above may well have closed it; nobody has re-measured the
   alignments suite since. That measurement is the cheapest remaining win.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  and [reference/SHADER_JS_CODEGEN.md](../reference/SHADER_JS_CODEGEN.md) — the *other*
  parity mechanism. Codegen makes sub-visual drift impossible; this gate catches
  visible drift. Neither subsumes the other, and a 3% pixel threshold cannot see
  a constant moving from 0.4 to 0.45.
- [reference/SCREENSHOT_CAPTURE_RACE.md](../reference/SCREENSHOT_CAPTURE_RACE.md)
  — the two blank-capture mechanisms, and which fix belongs to which.
- `products/jbrowse-web/browser-tests/README.md` — how to run it.
