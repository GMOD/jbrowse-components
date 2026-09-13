---
name: release-validation
description: How the v5 release was validated against the scale of v4.3.0..HEAD — the churn-proportional sample and why it stopped after one draw, the deleted-file walk, the three one-page concept specs, and the operating rules for the mutation sweep.
audience: internal
kind: measurement
---

# Release validation

`v4.3.0..HEAD` was 12,714 commits on 2026-08-21: 9,324 files, +1,049,123 /
−296,599, of which 4,334 are source `.ts`/`.tsx`. Commit-by-commit review is 12k
reviews, and the per-plugin diff is +127k lines for `alignments` alone.

Four things validate the release: the deleted-file walk, the three one-page
concept specs, reading code chosen for risk, and an RC in real use.

## The random sample, stopped after one draw

The first plan drew eight directories under `{plugins,packages,products}/*/src/`
with probability proportional to churn (seed `20260821`, `73ed883192`), gave
each a census, a read and a mutation sweep, and scored it *clean* / *thin* /
*bare*, with ≥3 of 8 thin or bare meaning draw eight more. One random unit
(`plugins/variants/src/shared`) and three risk-ranked units were scored, all
four thin, and the plan stopped on 2026-09-13 for two reasons:

- **The verdict is almost always thin.** A single surviving mutant makes a unit
  thin, and every unit of a few thousand lines carries an untested equality
  boundary — which is what every pilot survivor was.
- **Eight draws are too few for the rule.** A tree 30% weak passes "≤2 of 8"
  55% of the time, and a tree 50% weak passes it 15% of the time.

`scripts/release_sampling_frame.py` at `73ed883192` rebuilds the frame if a
sample is ever wanted again. The draw was 3,017 commits behind HEAD when it
stopped.

## Operating the mutation sweep

`scripts/mutation_sweep.py <dir or file>` swaps one comparison or boolean
operator at a time and reruns the tests that name the target. It reports which
lines the tests pin, which is what hardening a directory needs. Each rule below
cost a wasted run to learn.

- **Choose the test set by naming.** `jest --findRelatedTests` is transitive:
  asked for five gate files it answers **724** test files, because one is under
  `packages/core` and every plugin imports core somewhere — a near-full-repo run
  per mutant. Selecting tests that name one of the targets' exports gives
  **20**. The error runs in the safe direction: a test that exercises a target
  under another name goes unselected, so a mutant can read as SURVIVED that
  something in fact caught, which costs triage time and hides no gap.
- **Name the unit by its own files, and select from packages that can import
  it.** `packages/tree-sidebar/src` selected **748** test files by naming —
  `index` and `types`, which hold zero mutants, match nearly every test in the
  tree — and with those two dropped the baseline was still 421s and red: a
  jbrowse-web integration suite that says `hierarchy` once (164s, timing out
  under the load of a second sweep on the machine) and a data-management suite
  that says it four times (59s). The script skips those two basenames and greps
  only the unit's own package plus the packages whose `package.json` depends on
  it, which cut that oracle to 54 files.
- **Score against a green baseline only.** Against a red run every mutant reads
  as "caught" and the sweep reports a subsystem as perfectly pinned. A
  re-verification once scored two known survivors as "caught (2 existing)" where
  both failures were unrelated tests. Pair the guard with a post-run check that
  the mutation was still applied when jest finished, since a concurrent writer
  can revert it mid-run.
- **Bound each run by wall clock.** A table-driven suite that builds its cases
  at MODULE scope does that work outside every test, beyond `testTimeout`'s
  reach; one mutant stalled a run past 7 minutes against a 40s baseline. The
  script bounds runs and reports a timeout as `HUNG`, a separate status from the
  verdicts.
- **Run the credited file second.** It is usually the expensive one, and its
  answer matters only when every cheaper file let the mutant through.
- **Treat a worktree that ran a sweep as dirty until `git diff` proves it
  clean.** A killed sweep leaves a mutant in the tree that looks like a real
  edit — one plausible line in `git status`. The script restores from a
  `finally`, an `atexit` hook and a SIGTERM handler, and refuses to start on a
  dirty target, and one still got through: a session ended leaving
  `gateExempt`'s `configForceLoad || forceLoadTrack` as `&&`, which is exactly
  what the ADR-074 boolean exists to prevent and would have shipped as a real
  edit. Prefer the sweep's own mutant check over the restore path.
- **Give each sweep its own worktree and its own log.** One was still running,
  1h56m in, when a second started in the same worktree; its writes landed under
  the second's baseline and both runs' results were garbage. Two sweeps in
  separate worktrees sharing a scratchpad `sweep.log` truncated each other's
  output, exit reason included.
- **Create `node_modules/.cache` in a fresh worktree.** jest's `--outputFile`
  expects the directory to exist; a green baseline threw `ENOENT` writing its
  report and the script read "no usable report". The script creates it now.
- **Launch the sweep in a session of its own**, with
  `subprocess.Popen(…, start_new_session=True)`. The harness reaps an agent
  shell's process group when the call returns, and `nohup … &` stays in that
  group: one run got SIGTERM seconds after "baseline green".

## The deleted source files: done, and nearly clean

**Pin the command, and let it produce the number.** Three sessions produced 853,
841 and 787 for the deleted-file count and none was reproducible, because the
count moves with rename detection, which git skips partially on a diff this size
("exhaustive rename detection was skipped"). Non-test source under
`{plugins,packages,products}/*/src/`:

    769   git -c diff.renameLimit=6000 diff -M   --diff-filter=D   (renames excluded)
    792   git                          diff --no-renames --diff-filter=D

Use `-M`: the difference is files that merely moved. It still over-counts, since
`-M` pairs a moved file and leaves a file split in three as a deletion.

The method takes 6 seconds: take every name each deleted file exported at
v4.3.0 (one `git cat-file --batch` over all 769), build the set of identifiers
appearing anywhere at HEAD **once**, and intersect. A rename or a re-home drops
out. Grepping 400-name alternations over the tree is where a first attempt timed
out at ten minutes.

    769 deleted files  →  951 exported names  →  645 appear NOWHERE at HEAD
                       →  70 of those were named by a public entry file at v4.3.0

The upgrade guide covers the 70, mostly **by class**, plus a section of its own
for the six removed RPC method names, which callers address by string and so
sit outside every re-export list
([upgrading_v5.md](../../website/docs/developer_guides/upgrading_v5.md)
§"Removed RPC methods").

## The three one-page specs

The three concepts whose file and line counts grew most since `v4.3.0`, and
what each one's collapse found:

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
  files, 301 → ~1,950 implementation lines). **It stays at six
  representations**: two of them share one runtime type with incompatible byte
  layouts, and the conversion graph lacks the edge from the GPU layout back to
  the domain every color-math operation lives in. That gap is the finding, and
  `CORE_UTIL_AUDIT.md` names it as open.
