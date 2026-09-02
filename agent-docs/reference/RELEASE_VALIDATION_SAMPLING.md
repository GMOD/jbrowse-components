---
name: release-validation-sampling
description: How the v5 release is being validated — a churn-proportional sample of directories rather than a review of 12,714 commits, with a fixed per-unit protocol and two committed scripts. The pre-registered draw and its verdicts, and what the mutation sweep cost to learn: a green baseline or every mutant reads as caught, one sweep per worktree, and a worktree that has run one is dirty until proven otherwise.
audience: internal
---

# Release validation by sampling

## The method, and why not a review

`v4.3.0..HEAD` is 12,714 commits: 9,324 files, +1,049,123 / −296,599, of which
4,334 are source `.ts`/`.tsx`. Neither approach the size suggests works — commit
by commit is 12k reviews, and the per-plugin diff is still +127k lines for
`alignments` alone and cannot show a capability that left. Back-compat with
v4.3.0 is not the worry; it is used daily. The worry is that the cross-cutting
concepts grew edge cases nobody has enumerated.

So: validate the **current state** against oracles that need no diff, and take
confidence from a sample. The frame is 420 units (unit = a directory under
`{plugins,packages,products}/*/src/`) over 426,254 lines of churn, drawn
**probability proportional to churn** so that "k of n clean" is a claim about
the body of work. Sampling uniformly would be wrong — most units are tiny.

| script | what it does |
| --- | --- |
| `scripts/release_sampling_frame.py` | rebuilds the frame and the pre-registered draw |
| `scripts/mutation_sweep.py` | the per-unit operator sweep, resumable with `--start` |

## The per-unit protocol, fixed

Identical every time, ~1 hour, so verdicts are comparable:

- **census** — files and lines touching the unit's concept, now vs v4.3.0,
  naming what ARRIVED and what LEFT
- **read** — every source file, against the bug classes this repo has a history
  of: lifecycle/detach-destroy, autoruns writing what they read, fetch races,
  coordinate math, `||`/`??` hiding an undefined state
- **sweep** — `scripts/mutation_sweep.py` at the unit
- **verdict**, one of three, written down: *clean* (no survivors) / *thin*
  (survivors, tests exist but miss cases) / *bare* (no meaningful tests)

Three buckets and no more — the output has to be countable.

**The read, not the sweep, has produced every finding so far.** Mutation testing
proves tests pin code; it cannot see a gate whose predicate is simply the wrong
predicate, and reading found several of those. Treat the sweep as the cheap half.

## The draw, pre-registered

Seed `20260821`. The **set** is what is pre-registered — redrawing after seeing
a result, or substituting a unit for an easier one, turns an estimate into a
search. Order within the set is free, so work largest first; a unit with no
verdict has not been sampled.

**Random (PPS), for extrapolation:**

| churn | unit | verdict |
| ---: | --- | --- |
| 8,359 | `plugins/variants/src/shared` | thin |
| 4,078 | `packages/tree-sidebar/src` | |
| 2,382 | `plugins/alignments/src/LinearAlignmentsDisplay/renderers` | |
| 2,329 | `plugins/alignments/src/LinearAlignmentsDisplay/menus` | |
| 2,269 | `plugins/variants/src/LinearMultiSampleVariantDisplay/components` | |
| 2,004 | `plugins/variants/src/LDDisplay/components` | |
| 508 | `plugins/maf/src/MafAddTrackWorkflow` | |
| 503 | `plugins/linear-comparative-view/src/LinearSyntenyView/util` | |

**Risk-ranked (churn discounted by colocated tests), for bug finding:**

| churn | unit | verdict |
| ---: | --- | --- |
| 3,321 | `packages/product-core/src/Session` (2 tests) | thin |
| 1,333 | `packages/display-kit/src` (0 tests) | thin |
| 1,259 | `packages/core/src/util/color-bits` (0 tests) | thin |
| 4,572 | `plugins/linear-genome-view/src/LinearGenomeView` | |
| 3,189 | `plugins/variants/src/shared/components` | |
| 3,126 | `plugins/breakpoint-split-view/src/BreakpointSplitView/components` | |
| 1,557 | `packages/shader-tools/src` | |
| 795 | `plugins/spreadsheet-view/src/SpreadsheetView/components` (0 tests) | |

**Two tables deliberately.** A merged one invites reading "4 of 4 thin" as an
estimate, and only the first is one — a risk-ranked unit coming back thin is
what that ranking predicts. **The exit criterion counts the random table only**:
eight units sampled, and ≥3 thin or bare means drawing eight more, at which
point it is a survey rather than a sample and the extra cost is earned. It
stands at 1 of 8. The rest of the criterion: survivors triaged, the deleted
source files walked (done), a one-page spec for the top three concepts (done —
see below), and an RC out for two weeks with no P0 from real users.

## What the sweep cost to learn

Each rule is here because the absence of it wasted a run.

- **The test set is chosen by naming, not by `jest --findRelatedTests`.** That
  flag is transitive: asked for five gate files it answers **724** test files,
  because one is under `packages/core` and every plugin imports core somewhere.
  Correct as a dependency answer, useless as an oracle — a single mutant then
  costs a near-full-repo run. Selecting tests that name one of the targets'
  exports gives **20**. The error direction is safe: a test that exercises a
  target without naming it is missed, so a mutant can read as SURVIVED that
  something in fact caught — triage cost, never a hidden gap.
- **A barrel's name is not a name for the unit, and neither is a test that
  cannot import it.** `packages/tree-sidebar/src` selected **748** test files by
  naming — `index` and `types`, with no mutant between them, match nearly every
  test in the tree — and with those two dropped the baseline was still 421s and
  red: a jbrowse-web integration suite that says `hierarchy` once (164s, timing
  out under the load of a second sweep on the machine) and a data-management
  suite that says it four times (59s). The script now skips those two basenames
  and greps only the unit's own package plus the packages whose `package.json`
  depends on it, which leaves the pilot's plugin selection unchanged (products
  depend on every plugin) and cuts this unit's oracle to 54 files.
- **The baseline must be green before anything is scored.** Otherwise every
  mutant reads as "caught" against an already-red run and the sweep reports a
  subsystem as perfectly pinned. Not hypothetical: a re-verification once scored
  two known survivors as "caught (2 existing)" where both failures were
  unrelated tests. Pair the guard with a post-run check that the mutation was
  still applied when jest finished — a concurrent writer can revert it mid-run.
- **A mutant can hang instead of failing, and `testTimeout` will not save you.**
  A table-driven suite that builds its cases at MODULE scope does that work
  outside any test, where no per-test timeout applies; one mutant stalled a run
  past 7 minutes against a 40s baseline. Runs are bounded now and a timeout
  reports as `HUNG`, which is deliberately not a verdict.
- **Run the credited file second.** It is usually the expensive one, and its
  answer only matters when nothing cheaper caught the mutant.
- **A worktree that has run a sweep is dirty until proven otherwise.** A killed
  sweep leaves a mutant in the tree and it looks like a real edit — one plausible
  line in `git status`. The script restores from a `finally`, an `atexit` hook
  and a SIGTERM handler, and refuses to start on a dirty target, and one still
  got through: a session ended leaving `gateExempt`'s
  `configForceLoad || forceLoadTrack` as `&&`, which is exactly what the ADR-074
  boolean exists to prevent and would have shipped as a real edit. Read the diff
  before trusting it, and prefer the sweep's own mutant check over the restore
  path.
- **Two sweeps must never run in one worktree.** One was still running, 1h56m
  in, when a second started; its writes landed under the second's baseline and
  both runs' results were garbage. A sweep mutates shared files, so it owns the
  worktree while it runs.
- **A fresh worktree has no `node_modules/.cache`, and jest's `--outputFile`
  does not create it.** The baseline ran green, jest threw `ENOENT` writing the
  report, and the script read "no usable report" — one wasted run before the
  cause was found, because the script captured jest's stderr and printed none
  of it. The script now creates the directory.
- **Launch the sweep in its own session, not `nohup … &` from an agent
  shell.** The harness reaps the shell's process group when the call returns,
  and `nohup` does not leave the group: one run got SIGTERM seconds after
  "baseline green". The handler restored the tree, so it cost a baseline and
  nothing else — `subprocess.Popen(…, start_new_session=True)` is what
  survived.

## The deleted source files: done, and nearly clean

**Pin the command, not the number.** Three sessions produced 853, 841 and 787 for
the deleted-file count and none was reproducible, because it moves with rename
detection and git silently *partially* skips it on a diff this size ("exhaustive
rename detection was skipped" — and the partial answer is neither clean one).
Non-test source under `{plugins,packages,products}/*/src/`:

    769   git -c diff.renameLimit=6000 diff -M   --diff-filter=D   (renames excluded)
    792   git                          diff --no-renames --diff-filter=D

Use `-M`: the difference is files that merely moved. It is still an over-count —
`-M` sees a file that moved, not one split in three.

The method took 6 seconds once it was the right method: take every name each
deleted file exported at v4.3.0 (one `git cat-file --batch`, not 769 `git show`
spawns), build the set of identifiers appearing anywhere at HEAD **once**, and
intersect. A rename or a re-home drops out. Do NOT grep 400-name alternations
over the tree — that is where a first attempt timed out at ten minutes.

    769 deleted files  →  951 exported names  →  645 appear NOWHERE at HEAD
                       →  70 of those were named by a public entry file at v4.3.0

The upgrade guide covers the 70 — mostly **by class rather than by name**, which
is the right editorial call, plus a section of its own for the six removed RPC
method names, which are addressed by string and so are a surface no re-export
list reaches ([upgrading_v5.md](../../website/docs/developer_guides/upgrading_v5.md)
§"RPC methods that no longer exist").

## What is outstanding

[todo/sample-the-seven-remaining-random-release-validation-units.md](../todo/sample-the-seven-remaining-random-release-validation-units.md).
The pilot's findings are all fixed and pinned — git holds the detail, and the
one generalizable result is that **every mutation survivor was an equality
boundary**, which wants a second unit to confirm or refute.

## The three one-page specs

Ranked by the same measure that put the region-too-large gate first — file
count and line count both grown several-fold since `v4.3.0`, spread across
packages nobody owns end to end — the top three concepts, and what each one's
collapse found:

- [REGION_TOO_LARGE.md](REGION_TOO_LARGE.md) — the byte/density fetch gate: 24
  → 74 files, 112 → 562 lines. 73 named states collapse to 32 a consumer can
  distinguish and 7 the chrome/fetch autoruns actually read: a four-value
  verdict with a re-measure flag.
- [TRACK_REGISTRATION.md](TRACK_REGISTRATION.md) — the session/catalog/delta
  routing a track config takes through `addSessionTrackConf`,
  `publishTrackConf` and their four siblings. 32 named branches across six
  actions and two session mixins collapse to 17 consumer-visible outcomes and,
  further, to 4 destination values plus three small side channels.
- [COLOR_REPRESENTATIONS.md](COLOR_REPRESENTATIONS.md) — the packed-color
  concept the GPU rendering rollout doubled since `v4.3.0` (18 → 74 consumer
  files, 301 → ~1,950 implementation lines). **Does not collapse**: two of its
  six representations share one runtime type with incompatible byte layouts,
  and the conversion graph is missing the edge back from the GPU layout to the
  domain every color-math operation lives in. The finding is the gap itself,
  already named but not yet closed in `CORE_UTIL_AUDIT.md`.

Two things this deliberately does not cover: **design** (only the one-page spec
asks whether a shape is right) and **emergence** (unit-level mutation says
nothing about subsystems interacting — daily use and the RC cover that).
