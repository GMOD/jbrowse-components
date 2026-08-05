---
name: cross-backend-gate-ci
description: State of restoring the cross-backend render gate as blocking CI — the three-run measurement and why it does not clear the bar, the two structural blockers found (silent coverage loss, and an alignments settle wait that is vacuous), and the fix that already exists in the tree. Read before re-measuring or wiring the CI job.
---

# Cross-backend render gate → CI

`crossBackendGate.ts` diffs the canvas2d and webgl renders of the same run, so
it is a correctness oracle needing no golden. It ran non-blocking until
2026-07-16 and was removed (`f3cb3b962b`) because a check nobody reads is
decoration. `browser-tests/README.md` sets the bar for bringing it back: the
pileup drift explained, a few consecutive clean runs on an **idle** machine, then
`continue-on-error` dropped.

This handoff records an attempt at step 2 that did not clear it, and the two
blockers it surfaced.

## The measurement (2026-08-04)

Full suite, `runner.ts --backend=all --skip-webgpu --gate-only`, canvas2d vs
webgl on a real GPU, against an existing build (the gate is differential, so
build staleness cannot create false positives — both backends render the same
bundle in one run).

| Run | pairs compared | over threshold | uncompared | tests failed |
| --- | --- | --- | --- | --- |
| 1 | 148 | **4** | 15 | 11 |
| 2 | 130 | 0 | 33 | 18 |
| 3 | 149 | 0 | 14 | 15 |

**The machine was not idle** — load average 26–45 throughout, another agent
active in the same worktree. This is an upper bound on flakiness, not a
certification. Re-measure quiet before concluding anything about the rate.

Two findings worth keeping:

- **The noise floor is bit-stable.** The passing drift percentages were
  byte-identical across runs 2 and 3 (16.71 / 7.97 / 5.49 / 2.30). Deterministic
  renders really are deterministic, so the failures are a discrete race rather
  than continuous jitter — which is what makes a 0-false-positive gate plausible
  at all.
- **Every over-threshold failure was an alignments view** — `alignments-bam`
  (targeted *and* fullpage), breakpoint split view and methylation, the latter
  two hosting alignments tracks. No non-alignments view went over threshold in
  any of the three runs. That matches the whole historical record.

## Blocker 1: the gate loses coverage silently

A failed test produces no capture, and a snapshot captured by only one backend is
**skipped, not failed**. Run 2 reported "0 over threshold" while comparing 19
fewer pairs than run 3 — it passed by checking less.

For a hand-run tool that is fine. For a blocking gate it is the wrong failure
mode, and it interacts badly with the suite's own flakiness (11–18 test failures
per run here, mostly `pileup-display-done` never appearing inside the 60s
selector timeout).

**Fixed, and not with a minimum-pair threshold** — that was the first idea and it
would have needed tuning against a floor of legitimately single-backend
snapshots (`gpu-quirks`' context-loss case is WebGL-only). The precise fact makes
it unnecessary: `compareImages` calls `recordCapture` **before** its `gate-only`
early return, so a stale golden costs the gate nothing, and in gate-only mode
every failure still standing is one that happened *before* the screenshot — a
selector timeout, a failed navigation, a blank-canvas assertion. Each of those,
and only those, removes a pair.

So `--gate-only` no longer ignores `totalFailed`. The old comment on that branch
already contained the refutation — it excused per-test failures as
"mostly UI-interaction timeouts, which produce no snapshot for the gate to
compare" — which is the reason to fail, not to pass. `runCrossBackendGate` also
returns `skippedNames` now and the runner prints them, because a bare count
cannot distinguish a structural skip from one that timed out this run.

## Blocker 2: `waitForMorphIdle` is vacuous for alignments

`snapshot.ts` called it "the confirmed cause of the pileup gate flakiness". It
cannot be: `morphFromTops` is declared only in `plugins/canvas`
`LinearBasicDisplay/baseModel.ts` and read only by that plugin's
`FeatureComponent`. `LinearAlignmentsDisplay` has no such field, so the
predicate reads `undefined == null` → true on the first poll and the wait returns
immediately — for exactly the displays that flake.

This is the third place the same overclaim has appeared; `8d8239d3ad` corrected
it in `README.md` and `crossBackendGate.ts` and it grew back in `snapshot.ts`.
The comment is now corrected there too. **Grep `morphFromTops` before crediting
that wait with anything.**

The diff image agrees with the structural argument: `targeted_alignments-bam`
showed one backend rendered full width and the other painted only the left ~47%
— a capture taken mid-paint, not a shader divergence.

### Fixed by composing the waits that already existed

`packages/browser-test-utils/src/waits.ts` had both halves and `snapshot.ts`
called neither. They **compose** — the first instinct, to swap the morph wait for
`waitForDisplaysDone`, is wrong twice over:

- The morph wait is real for `LinearBasicDisplay`; it is only *insufficient*,
  and it is the last signal to settle. Keep it.
- `waitForDisplaysDone` alone would not have fixed this. It keys on
  `canvasDrawn`, which is **first paint** and flips on a partially-filled canvas
  while later blocks are still fetching — exactly the half-painted
  `targeted_alignments-bam` capture. `waitForDisplayPhases` is the direct read
  ("no display is in its `loading` phase", off DisplayChrome's own
  `data-display-phase`) and is the one that covers the outstanding fetch.

`snapshot.ts` now has one `waitForCaptureSettled` used by both `pageSnapshot`
and `canvasSnapshot`, running overlay-gone → phases → displays-done → morph-idle,
in that order because each is blind to what the next one sees. All four stay
best-effort: a timeout proceeds to the capture, since a loud wrong image beats an
opaque wait error, and `assertNonBlank` is still the backstop.

## Do not re-derive

- **`fullPage` is already fixed and is not this.** The 2026-07-26 finding
  (viewport resize → blank captures) landed; `pageSnapshot` takes a plain
  viewport screenshot. The remaining alignments flake is a *different* capture
  problem. Never reintroduce `fullPage`.
- **The gate is blind to a bug both backends share.** It would have caught
  neither render bug found on 2026-07-16. Goldens are the other half, and they
  only refresh by hand.
- **Threshold overrides are where the gate is told not to look.**
  `grep -c 'match:' products/jbrowse-web/browser-tests/crossBackendGate.ts` — nine
  entries, unchanged since `333db010c9` (2026-07-09). This file said seven for
  several rounds, so count them rather than trusting the number; an audit that
  goes looking for seven stops two short. `targeted_inversion-pbsim-coverage`
  sits at 16.71% under a 20% ceiling in every run — a real, stable divergence
  the gate is configured to accept. That list wants auditing, not growing.
- **`EXCLUDED_SUBSTRINGS` is empty.** Scoping to deterministic views is done with
  `--filter` (substring match on suite name), not by excluding.
- Port 8123 `serve` leftovers on this machine are unrelated — the runner uses
  3333.

## After both fixes (same day, same build)

Six consecutive runs, same build, same machine, load varying with other work:

| Run | load at start | tests | pairs compared | over threshold | uncompared | exit |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 11.5 | 292 / 20 | 131 | 1 | 32 | 1 |
| 2 | 21.0 | 310 / 2 | 159 | 0 | 4 | 1 |
| 3 | 7.5 | **312 / 0** | **163** | **0** | **0** | **0** |
| 4 | 27.4 | 306 / 6 | 151 | 0 | 12 | 1 |
| 5 | 33.9 | 309 / 3 | 157 | 0 | 6 | 1 |
| 6 | 37.1 | 298 / 14 | 141 | 0 | 18 | 1 |

**The drift comparison itself is clean: zero over-threshold in runs 2–6**, five
consecutive, comparing 141–163 pairs each, across loads from 7.5 to 37. The one
drift failure in the whole set is run 1's methylation, discussed below. Run 3 is
the first fully clean run — every test passed, every snapshot compared, nothing
drifted — and its 163 pairs beat the pre-fix best of 149, so the wait fix does
not merely stop the gate lying about coverage, it *raises* coverage, because
fewer tests fail before their screenshot.

What still varies is **capture reliability** — `assertNonBlank` failures. Those
were initially written off here as machine-load contention. **That was wrong, and
the instrumentation says so.**

## The blank captures are not a slowness problem

Every wait in `waitForCaptureSettled` swallows its own timeout, which left
"settled" and "gave up waiting" indistinguishable and made a blank capture
unattributable. Each wait's post-condition is now re-checked afterwards
(`PENDING_DISPLAYS` is exported from browser-test-utils for exactly this) and the
verdict goes into the failure message.

One instrumented full run, 9 test failures, 16 blank captures:

**16 of 16 read "all capture waits settled". Zero were attributed to a wait that
expired.** Four further runs (the A/B below) added 18 more, all the same way:
**34 of 34.**

So at capture time the loading overlay was down, no display was in its `loading`
phase, every display had reported `canvasDrawn`, and morph was clear — and the
canvas was still empty. **No amount of additional waiting can fix that**, which
means the README's "idle machine" precondition is treating a symptom. Load
changes how often it happens, not whether it can.

Two more facts that reshape the story:

- **Both backends blank.** 7 webgl, 2 canvas2d. It is not a GPU-driver or
  headed-compositor story, so the plan to "measure under swiftshader instead"
  would not have settled it either.
- It appears to violate a documented invariant — ARCHITECTURE/`agent-docs`
  CLAUDE.md: *"The render callback returns `true` only when real content was
  drawn, or the loading scrim stays up."* A display reporting drawn over an empty
  canvas is that invariant failing intermittently.

### `preserveDrawingBuffer` — tested, REFUTED. Do not retry it.

`preserveDrawingBuffer` appears nowhere in the tree, so every WebGL context takes
the default `false`, under which the drawing buffer is cleared once composited
and a readback after a frame boundary returns empty. That fit every symptom, so
it was tested properly rather than adopted: a harness-side
`evaluateOnNewDocument` patch of `getContext` (verified first against a plain
canvas — `false` without, `true` with, other attributes preserved), run
**interleaved** A/B/A/B against the same build, because machine load drifts and
absolute counts across sequential runs had already misled once.

| Arm | flag | load | tests failed | webgl / canvas2d | pairs compared |
| --- | --- | --- | --- | --- | --- |
| A1 | off | 1.2 | 2 | 2 / 0 | 161 |
| B1 | **on** | 10.5 | 1 | 1 / 0 | 161 |
| A2 | off | 13.6 | 9 | 2 / 7 | 153 |
| B2 | **on** | 12.0 | 15 | 10 / 5 | 148 |

No improvement; the treatment arm was worse at comparable load (B2 15 failures
against A2's 9). The flag was removed again — it is not in the tree, and this
table is the reason.

**The result that kills the whole WebGL framing: A2 failed 7 canvas2d tests
against 2 webgl.** Canvas2D has no drawing buffer to clear, so a blank there
cannot have a WebGL cause, and the two backends failing together points at one
mechanism rather than two.

### Compositor double-rAF — tested, INCONCLUSIVE. Also not in the tree.

Same interleaved design, C/R/C/R, one build:

| Arm | rAF wait | load | tests failed | webgl / canvas2d | blank captures |
| --- | --- | --- | --- | --- | --- |
| C1 | off | 2.5 | 13 | 2 / 11 | 5 |
| R1 | **on** | 12.9 | 1 | 1 / 0 | 1 |
| C2 | off | 12.9 | 4 | 4 / 0 | 0 |
| R2 | **on** | 16.8 | 7 | 6 / 1 | 3 |

Total failures look better (8 vs 17) but **blanks — the thing the hypothesis is
about — went 5 to 4**, and the within-arm spread (R1 = 1, R2 = 7) is as large as
the between-arm difference. The treatment was verified active first, the same way
`preserveDrawingBuffer` was: a double rAF resolves in **58 ms** under swiftshader
and **1670 ms** in plain headless, so it delays real time and is not a no-op —
1.67 s × ~160 captures is also why it was reverted rather than kept "just in
case".

**The methodological finding is the durable one: a whole-suite A/B cannot
resolve an effect of this size.** Failure counts today ranged 0–20 per run under
nominally identical conditions. Two runs per arm is nowhere near enough, and
there is no tight reproducer to substitute — the blanks are spread thinly across
many different captures rather than concentrated in one. **Stop running
whole-suite A/Bs against this.**

### Blank retry + timeout attribution: BOTH TRIED, BOTH REVERTED

Two changes were landed and then reverted together (`28c6ee6d90` reverts
`839113dabe` and `cb2f8524fd`). The idea in each was sound and the execution made
things **worse in the one dimension they existed to improve** — how legible a
failure is.

- **Re-take a blank capture** up to 3 times before believing it, on both paths
  that report one, counting the retries out loud.
- **Say what a display was doing** when its `-done` wait expired, instead of an
  opaque timeout.

What actually happened, from a full-suite control at `cb2f8524fd~1` on the same
build and machine:

| build | tests | failure modes |
| --- | --- | --- |
| control (pre-retry) | 303 / **9** | 4 `-done` timeouts, 5 blank captures |
| retry only | 307 / 5 | 1 "Node is detached from document" |
| retry + attribution | 303 / **9** | **9 × "Node is detached from document"** |

Same failure *count*, completely different *mode*: a diagnosable mix became nine
opaque puppeteer internal errors, three of them on the very tests that had been
reporting a timeout or a blank. "Node is detached" appeared in **zero of the
nineteen full runs before `cb2f8524fd`**.

Reverted rather than patched, because the mechanism is not understood. Nothing in
either diff obviously holds an `ElementHandle` across a re-render on the *first*
attempt, and the retry loop never ran a second iteration in any of these runs —
no `Blank re-captures` line was ever printed, so the retry was never even
exercised.

**A next attempt should**: re-query the selector on each attempt rather than
reusing the handle from the initial wait, and prove the mechanism on a targeted
reproduction before landing anything.

An earlier version of the retry was worse still and was caught the same way — it
re-ran `waitForCaptureSettled` between attempts, scoring 10 passed / 8 failed
against a baseline of 18 / 0 on the same filter minutes apart (it can add ~100 s
per retry, and `assertCanvasHasContent` is called mid-test by callers who have
*not* finished loading, so page-wide waits change what that helper means).

**The lesson is the durable part, and it now has two scalps: baseline any change
to this suite against HEAD on the same filter, and compare failure MODES, not
just totals.** The second run of this pair had an identical failure count to its
control and was still a regression.

### There are (at least) two failure modes, not one

Counting them together is part of why the numbers were so noisy:

- **Timeout** — a display never reports `-done` within 60 s.
- **Blank-with-waits-settled** — a display reports done over an empty canvas.

A single run produced 4 of the first and 1 of the second. **All five were
canvas2d**, which is one more nail in every WebGL-specific framing.

### Next: it is the capture, not the render — and the diagnostic is now in place

Everything now points away from the app and at the screenshot. `el.screenshot()`
goes through Chrome's capture path, which serves composited layers — so if the
canvas content has been drawn but not yet composited into the layer tree, the
capture is blank while every app-level signal is legitimately true. That is
backend-agnostic (explains canvas2d), load-sensitive (explains the frequency),
and immune to waiting on app state (explains 34/34), which no other candidate so
far manages at once.

Rather than test that statistically — which the variance above rules out — the
question is now asked **directly, on the failing path**. `el.screenshot()` serves
composited layers; `canvas.toDataURL()` reads the backing store and never touches
the compositor. So when a capture comes back blank, both `canvasSnapshot` and
`assertCanvasHasContent` now ask the canvas itself and put the answer in the
failure message:

```
[self-report: canvas 1280x400 HAS content (…b) while the screenshot is blank
              -> capture/compositing side]
[self-report: canvas 1280x400 is ALSO blank -> render side]
```

**One occurrence settles it. No A/B, no quiet machine, no reproducer needed.**
The run that added it happened to produce no blank through those paths (its five
failures were four timeouts and one blank through the then-uninstrumented
`assertCanvasHasContent`, now covered), so **the verdict is still outstanding —
read it off the next run that blanks.**

Caveat noted inline: on a WebGL canvas whose drawing buffer was already cleared,
`toDataURL` also reads blank, so a "render side" verdict on webgl is not
conclusive. On canvas2d it is.

**A stable drift percentage does not mean a stable failure.**
`fullpage_methylation_snapshot` came in at exactly 37.98% in two runs hours
apart, which reads like a deterministic divergence — and is not one: run 2
compared it and it passed under 3%. A blank-vs-rendered capture is a *fixed*
diff, so the magnitude reproduces while the occurrence stays racy. Don't infer
determinism from a repeated number; check whether the pair was compared at all.

## Next, in order

1. **Re-attempt the timeout attribution and the blank retry, carefully.** Both
   were reverted (see above); the ideas stand, the executions did not. Re-query
   the selector per attempt rather than holding the handle, and prove the
   mechanism on a targeted reproduction first.
2. **Attribute the TIMEOUT mode, which is the dominant one.** The last two
   full runs produced zero blanks and 4–5 timeouts each: a display never reports
   `-done` inside 60 s. Apply exactly the move that worked for blanks — when the
   wait expires, report what state the display is actually in (`data-display-phase`,
   whether the wrapper exists at all, whether an error banner is up) instead of
   an opaque timeout. `waits.ts` already notes the likely shape: a display in a
   terminal `tooLarge`/`renderError` state renders no wrapper and so can never
   report done, which would read as a timeout forever.
3. **Read the blank self-report verdict off the next run that blanks** (that
   instrumentation went out with the revert too — restore it as part of step 1). Already
   wired on both paths, costs nothing until something fails, no experiment to
   design. Then fix whichever side it names.

   Do **not** spend another round chasing quiet machines (34/34 says waiting on
   app state is not the lever), do **not** retry `preserveDrawingBuffer` (tested,
   refuted), do **not** re-run a whole-suite A/B for this (variance 0–20 failures
   per run swamps it), and count the timeout mode separately from the
   blank-with-waits-settled mode.
2. **Only then, consecutive clean runs**, and in the CI configuration
   (`--swiftshader` headless, per `pnpm test:browser:gate`) rather than the real
   GPU used here. Note the `load=` column is start-of-run, which is why run 1's
   11.5 looks out of order against run 4's 27.4 — it was rising through a
   concurrent build.
3. Then restore `f3cb3b962b`'s job without `continue-on-error`, scoped by
   `--filter` to the deterministic suites.

The removed job is recoverable verbatim from `f3cb3b962b`; it needs `tabix`,
`./.github/actions/setup` and `./.github/actions/build-jbrowse-web`, and runs
`pnpm test:browser:gate` in `products/jbrowse-web`. Note GitHub runners have no
GPU, so CI must use swiftshader (which leaks ~29 MB per WebGL context, ADR-024)
— a full-suite gate is not on the table, a curated ~10 views is.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  and [guides/SHADER_JS_CODEGEN.md](../guides/SHADER_JS_CODEGEN.md) — the *other*
  parity mechanism.
  Codegen makes sub-visual drift impossible; this gate catches visible drift.
  Neither subsumes the other, and a 3% pixel threshold cannot see a constant
  moving from 0.4 to 0.45.
- `products/jbrowse-web/browser-tests/README.md` — the standing bar for CI.
