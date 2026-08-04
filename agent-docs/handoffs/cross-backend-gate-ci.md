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
- **Threshold overrides are where the gate is told not to look.** Seven entries
  in `THRESHOLD_OVERRIDES`, and `targeted_inversion-pbsim-coverage` sits at
  16.71% under a 20% ceiling in every run — a real, stable divergence the gate
  is configured to accept. That list wants auditing, not growing.
- **`EXCLUDED_SUBSTRINGS` is empty.** Scoping to deterministic views is done with
  `--filter` (substring match on suite name), not by excluding.
- Port 8123 `serve` leftovers on this machine are unrelated — the runner uses
  3333.

## After both fixes (same day, same build)

| Run | load at start | tests | pairs compared | over threshold | uncompared | exit |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 11.5 | 292 / 20 | 131 | 1 | 32 | 1 |
| 2 | 21.0 | 310 / 2 | 159 | 0 | 4 | 1 |
| 3 | 7.5 | **312 / 0** | **163** | **0** | **0** | **0** |

Run 3 is the first fully clean run: every test passed, every snapshot compared by
both backends, nothing drifted. Note 163 > the pre-fix best of 149 — the wait fix
does not merely stop the gate lying about coverage, it *raises* coverage, because
fewer tests now fail before their screenshot.

The three rows track machine load rather than anything in the code, and the
residual failure mode is `assertNonBlank` on **webgl** captures (17 of run 1's 20
failures) — the headed real-GPU browser returning blank frames under contention.
That is an environment property, not a gate defect, and it is the reason the
README says *idle*.

**A stable drift percentage does not mean a stable failure.**
`fullpage_methylation_snapshot` came in at exactly 37.98% in two runs hours
apart, which reads like a deterministic divergence — and is not one: run 2
compared it and it passed under 3%. A blank-vs-rendered capture is a *fixed*
diff, so the magnitude reproduces while the occurrence stays racy. Don't infer
determinism from a repeated number; check whether the pair was compared at all.

## Next, in order

1. **Consecutive clean runs on a genuinely idle machine.** One clean run is not
   the README's bar. Load must be low for the whole run, not just at its start.
2. **Measure in the CI configuration, which is not this one.** These runs used
   webgl on the real GPU (headed). GitHub runners have none, so CI uses
   `--swiftshader` — that is what `pnpm test:browser:gate` passes, and it removes
   real-GPU contention as a variable while adding software-raster slowness and
   the ~29 MB/context leak (ADR-024).
3. Then restore `f3cb3b962b`'s job without `continue-on-error`, scoped by
   `--filter` to the deterministic suites.

The removed job is recoverable verbatim from `f3cb3b962b`; it needs `tabix`,
`./.github/actions/setup` and `./.github/actions/build-jbrowse-web`, and runs
`pnpm test:browser:gate` in `products/jbrowse-web`. Note GitHub runners have no
GPU, so CI must use swiftshader (which leaks ~29 MB per WebGL context, ADR-024)
— a full-suite gate is not on the table, a curated ~10 views is.

## Related

- [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  and [shader-js-codegen](shader-js-codegen.md) — the *other* parity mechanism.
  Codegen makes sub-visual drift impossible; this gate catches visible drift.
  Neither subsumes the other, and a 3% pixel threshold cannot see a constant
  moving from 0.4 to 0.45.
- `products/jbrowse-web/browser-tests/README.md` — the standing bar for CI.
