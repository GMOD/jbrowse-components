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
selector timeout). **Assert a minimum compared-pair count before wiring CI**, so
a degraded run fails loudly instead of reporting clean.

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

### The fix probably already exists

`packages/browser-test-utils/src/waits.ts` has `waitForDisplaysDone`, which
handles all three test-id shapes — `display-<id>`, `<name>-display` (this is the
one that matches `pileup-display`), and `synteny_canvas` — and keys on the
*absence* of pending wrappers so it waits for the last display rather than the
first. `PileupComponent.tsx` already flips `pileup-display` → `pileup-display-done`
off `canvasDrawn`.

`browser-tests/snapshot.ts` does not use it. It uses the vacuous morph wait
instead. Wiring the existing helper in is the obvious first thing to try.

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

## Next, in order

1. Assert a minimum compared-pair count so coverage loss fails loudly.
2. Replace `waitForMorphIdle` in `snapshot.ts` with `waitForDisplaysDone`.
3. Re-run 3× on an idle machine. If the only failures remain alignments views,
   scope the CI job to the deterministic suites — that subset was clean 3/3 even
   under load — and restore `f3cb3b962b`'s job without `continue-on-error`.

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
