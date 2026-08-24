---
name: release-validation-by-sampling
description: 12,714 commits and 426k lines of source churn since v4.3.0 is past the size where reviewing the change is a plan at all, so confidence has to come from sampling units and extrapolating. The pilot and four units are done, the tooling has a home, and every unit so far came back thin — what is left is seven more random draws and a one-page spec for the top three concepts — the deleted-file walk is done and came back nearly clean.
---

# Release validation by sampling

## The question

`v4.3.0..HEAD` is 12,714 commits over three months: 9,324 files, +1,049,123
/ −296,599, of which 4,334 are source `.ts`/`.tsx` and 769 are non-test source
files deleted outright (that number needs its command — see the walk below). Neither approach the size suggests actually works — commit by
commit is 12k reviews, and the per-plugin diff is still +127k lines for
`alignments` alone and cannot show a capability that left.

The worry is not back-compat with v4.3.0, which is in the dust and used daily.
It is that the **cross-cutting concepts grew edge cases nobody has enumerated**:
the region-too-large gate went 24 → 74 source files and 112 → 562 lines, one
221-line `FeatureDensityMixin` becoming a 984-line `RegionTooLargeMixin` plus
`regionTooLargeUtils` (240), `CanvasFeatureGateMixin` (273), `densityGate` (138)
and reads in `render-core/displayPhase` and `core/rpc/byteBudget`.

So the plan validates the **current state** against oracles that need no diff,
and gets its confidence from a sample rather than from coverage.

## What is done: the pilot

One subsystem, ~2 hours, on the concept the expansion worry was raised about.

**The truth table** — `packages/display-kit/src/gateTruthTable.test.ts`
composes the real `RegionTooLargeMixin` and overrides its nine leaves, so a row
costs one `create` with no view, track or config node. It crosses every boolean
against boundary values for span, adapter limit and bytes:

    67,200 rows  →  73 distinct behaviors  →  a 149-line golden file

**73 is the count with every intermediate getter named**, and naming them is
what makes the golden a tripwire — but it is also what makes the subsystem read
as having 73 states, which it does not. Collapse the key to what a consumer can
tell apart and it is **32**, of which 25 are the worker budget's five values
riding along; collapse it to what `DisplayChrome` and the fetch autoruns
actually read and it is **7**. Both numbers are now in the golden's header,
above the detail, with the 7 listed. That is the answer to "is the shape right?"
for this concept, and it is a better one than the 73: the gate is a four-value
verdict with a re-measure flag, and the rest is how it is arrived at.

Eleven invariants hold across all 67,200: gated ⟺ non-empty reason ⟺ defined
axis; force-load exempts both axes; an unmeasured view never gates; a worker
budget exists exactly when `gateActive`; a non-positive adapter limit is
indistinguishable from `undefined`; more bytes never gates less; a larger budget
never gates more; zooming in never turns ungated into gated; "zoom in" is
withheld only from a byte-gated display.

**The suite is real.** Seven hand-authored sabotages, including the historical
one this subsystem's own test header records (dropping `aboveForceLoadFloor`
from `densityGateActive`, which once left all 1,681 lines of the five plugins'
`derivedRegionTooLarge.test.ts` green) — **the pre-existing test files caught all
seven**. That is the pilot's most important output, and it is evidence about
more than the gate: the same process wrote all 4,334 changed source files and
all 1,517 new test files.

The truth table's value is therefore **not** extra mutation-catching power. It
is a 149-line review artifact standing in for a 984-line mixin, a behavioral
tripwire whose header line is a one-number summary of the subsystem (73, which
becomes 97 under the sabotage above), and a boundary-case finder. It costs ~35s
a run, which is most of what a sweep over the gate now pays per mutant.

## The tooling, and what it cost to learn

Both scripts are committed and every subsequent unit runs them:

| script | what it does |
| --- | --- |
| `scripts/release_sampling_frame.py` | rebuilds the frame and the pre-registered draw; reproduces the draw below exactly |
| `scripts/mutation_sweep.py` | the per-unit operator sweep, resumable with `--start` |

Three things about the sweep are load-bearing, and each is there because the
absence of it cost a run:

- **The test set is chosen by naming, not by `jest --findRelatedTests`.** That
  flag is transitive: asked for the five gate files it answers **724** test
  files, because one is under `packages/core` and every plugin imports core
  somewhere. Correct as a dependency answer, useless as an oracle — it makes a
  single mutant cost a near-full-repo run. Selecting tests that name one of the
  targets' exports gives **20**. The error direction is safe: a test that
  exercises a target without naming it is missed, so a mutant can read as
  SURVIVED that something in fact caught, which costs triage and never hides a
  gap.
- **The baseline must be green before anything is scored.** Without it every
  mutant reads as "caught" against an already-red run, and the sweep reports a
  subsystem as perfectly pinned. This is not a hypothetical: during the
  collision below, a re-verification run scored two known survivors as
  "caught (2 existing)" where both failures were `renamedGateHooks.test.ts`
  tests unrelated to the mutation. The guard turns that silent false CAUGHT into
  a refusal to start, and it is the reason the findings table below can be
  trusted. Pair it with a post-run check that the mutation was still applied
  when jest finished — a concurrent writer can revert it mid-run.
- **A mutant can hang instead of failing, and `testTimeout` will not save you.**
  A table-driven suite that builds its cases at MODULE scope — the gate's truth
  table enumerates 67,200 rows there — does that work outside any test, where no
  per-test timeout applies. One mutant stalled a run past 7 minutes against a 40s
  baseline. Every run is now bounded and a timeout is reported as `HUNG`, which
  is deliberately not a verdict: it needs a look by hand.
- **Run the credited file second.** It is usually the expensive one (the truth
  table is ~35s of a ~40s run) and its answer only matters when nothing else
  caught the mutant, so a caught mutant should cost the cheap files alone.
- **A killed sweep leaves a mutant in the tree, and it looks like a real edit.**
  `git status` shows one plausible line, `git checkout --` fixes it, and nobody
  notices otherwise. The script now restores from a `finally`, an `atexit` hook
  and a SIGTERM handler, and refuses to start on a dirty target.

  **Those three do not cover every death, and one got through.** The session
  that wrote them ended leaving `gateExempt`'s `configForceLoad || forceLoadTrack`
  as `&&` in this worktree — force-load only lifting the gate when *both* the
  config slot and the button said so, which is a plausible-looking line, is
  what the ADR-074 boolean exists to prevent, and would have shipped as a real
  edit. A later session found it by reading `git status` in the worktree before
  doing anything else. So: **a worktree that has run a sweep is dirty until
  proven otherwise** — read the diff before trusting it, and prefer the mutant
  check the sweep already does (was the mutation still applied when jest
  finished) over trusting the restore path.

**Two sweeps must never run in one worktree.** The pilot's `scratch-sweep.py`
was still running when this session started — 1h56m in, writing into
`byteBudget.ts` from a shell nobody was reading — and its writes landed under a
second sweep's baseline. Both runs' results were garbage, and the twice-observed
"leftover mutant" was not a leftover at all but a live write. A sweep mutates
shared files, so it owns the worktree while it runs.

## Findings, and where each goes

A mechanical operator sweep (`&&`↔`||`, `>`↔`>=`, `===`↔`!==`) over the five
gate files, 39 mutants. **Every survivor was an equality boundary**, which is the
generalizable part and belongs in `reference/` once a second unit confirms or
refutes it.

Each row below was re-run individually on a verified-green baseline in a quiet
worktree, with a post-run check that the mutation was still applied when jest
finished. The table survived a corrupted process, which is luck rather than
method — the guards above are the method.

| site | mutation | note |
| --- | --- | --- |
| `CanvasFeatureGateMixin.ts:178` | `density > max` → `>=` | **the real one**, and **fixed**. The byte axis pins exactly-at-the-limit (`byteBudget.test.ts` "is over only when strictly above the budget"); the density axis had the comparison written out three times and pinned in one. It is now `overDensityBudget` beside `featuresPerPx`, the counterpart to `overByteBudget`, with all three callers on it |
| `RegionTooLargeMixin.ts:489` | `spanBp >= AUTO_FORCE_LOAD_BP` → `>` | a span of exactly 20,000 stops counting as above the floor: density axis off, budget doubled. Caught **only** by the truth table → already pinned |
| `regionTooLargeUtils.ts:134` | `bytes / previous.bytes > ZOOM_EVIDENCE_BYTE_RATIO` → `>=` | exactly 0.9 unpinned → **pinned**, along with the span ratio at exactly ½, in `regionTooLargeUtils.test.ts` |
| `CanvasFeatureGateMixin.ts:215` | `measurements.length === 0 \|\| !viewport` → `&&` | no test had one term true and the other false → **pinned**, both directions, in the multi-row `derivedRegionTooLarge.test.ts` |
| `CanvasFeatureGateMixin.ts:253` | `NODE_ENV !== 'production'` → `===` | equivalent-under-test, not a defect. Recorded so nobody re-derives it |

All four live rows were re-run under the mutation after the fix and are now
CAUGHT. The density one is caught three times over, because consolidating the
comparison means one mutation site now reaches every caller — which is the
argument for consolidating it rather than adding a third test.

## The sample so far

Four units, each on the fixed protocol below. **The two samples get two tables,
deliberately** — a merged one invites reading "4 of 4 thin" as an estimate, and
only the first table is one.

**The estimate — random draw, 1 of 8 done:**

| unit | verdict | what the tests miss |
| --- | --- | --- |
| `plugins/variants/src/shared` | thin | the sort→colorBy path, the phased gate on a haploid callset, and the whole cell-style/allele-colour layer has no direct test |

**Not an estimate — risk-ranked, chosen for being under-tested, 3 of 8 done:**

| unit | verdict | what the tests miss |
| --- | --- | --- |
| `packages/core/src/util/color-bits` (0 tests) | thin | not one assertion in the repo passes an out-of-range value into the unit, which is exactly where it misbehaved |
| `plugins/linear-genome-view/src/BaseLinearDisplay` (0 tests) | thin | the unit is now 152 lines of barrel; its `models/` destination is among the best-tested code in the repo, and what nothing pins is the export surface itself |
| `packages/product-core/src/Session` (2 tests) | thin | no snapshot round-trip test and no v4.3.0-shaped session load test anywhere |

A risk-ranked unit coming back thin is close to what that ranking predicts, so
those three say nothing about the body of work. **The exit criterion's "≥3 of 8
thin or bare" counts the random sample only, and is not tripped: it stands at
1 of 8.**

The more useful result is one the protocol does not have a column for. Mutation
testing proves tests pin code; **it cannot see a gate whose predicate is simply
the wrong predicate**, and reading found several of those. Every finding below
came from the read, not the sweep.

### Fixed outright

- **`packages/core/src/util/color-bits`** — the composition
  `(r << 24) + (g << 16) + (b << 8) + a` wrapped each channel and carried the
  overflow into its neighbour, and `set` masked rather than clamped. So
  `rgb(0 0 0 / -20%)` parsed to **white at 80%**, `rgb(110%, 0%, 0%)` to
  near-black, and the documented jexl `alpha(color, n)` returned a 40%-opaque
  feature for a caller asking for 1.4 — a plausible wrong colour every time,
  never a throw. One `clampByte` in `bit.ts`, used by `newColor` and `set`.
  Separately, hue is periodic and `hueToRGB` corrects by at most one turn, so
  `hsl(-720deg)` read as yellow; `parseAngle` now folds, and every caller of it
  is a hue. `clamping.test.ts` pins both, and in-range values are byte-identical.

### Filed to [TODO.md](../TODO.md)

Eight entries: the sort→colorBy palette loss (verified against the built ESM),
the phased-mode gate, the clustering matrices trusting feature 0's header, the
silent `samplesTsv` mismatch, an edited track config surviving its own undo, six
unrecorded session/plugin ABI removals, v4.3.0's per-view highlight setting, and
a leftovers entry carrying seven smaller items including the gate's equality
boundaries above.

## The plan

### 1. The frame

420 units (unit = directory under `{plugins,packages,products}/*/src/`),
426,254 lines of source churn, built by `scripts/release_sampling_frame.py`.
Sampling uniformly would be wrong — most units are tiny and the estimate would
say nothing about where the code went. Draw **probability proportional to
churn**, so "k of n clean" is a claim about the body of work.

### 2. Two samples, kept apart

A finding in one says nothing about the other. **Pre-registered, seed
`20260821`** — redrawing after seeing a result turns an estimate into a search.

**Random (PPS), for extrapolation** — ✅ done, ⬜ outstanding:

    ✅ 8359  plugins/variants/src/shared
    ⬜  503  plugins/linear-comparative-view/src/LinearSyntenyView/util
    ⬜ 2269  plugins/variants/src/LinearMultiSampleVariantDisplay/components
    ⬜  508  plugins/maf/src/MafAddTrackWorkflow
    ⬜ 2004  plugins/variants/src/LDDisplay/components
    ⬜ 2382  plugins/alignments/src/LinearAlignmentsDisplay/renderers
    ⬜ 4078  packages/tree-sidebar/src
    ⬜ 2329  plugins/alignments/src/LinearAlignmentsDisplay/menus

**Risk-ranked (churn discounted by colocated tests), for bug finding:**

    ✅ 1333  plugins/linear-genome-view/src/BaseLinearDisplay          0 tests
    ✅ 1259  packages/core/src/util/color-bits                         0 tests
    ✅ 3321  packages/product-core/src/Session                         2 tests
    ⬜ 3126  plugins/breakpoint-split-view/src/BreakpointSplitView/components
    ⬜ 4572  plugins/linear-genome-view/src/LinearGenomeView
    ⬜ 3189  plugins/variants/src/shared/components
    ⬜  795  plugins/spreadsheet-view/src/SpreadsheetView/components    0 tests
    ⬜ 1557  packages/shader-tools/src

Of the two units carrying >800 lines of churn and no colocated test, both are
now done: `BaseLinearDisplay` was the 152-line barrel (its churn is code moving
out, into a well-tested `models/`), and `color-bits` was the bit-twiddling one,
which is where the clamping bugs were.

### 3. The per-unit protocol, fixed

Identical every time, ~1 hour, so verdicts are comparable:

- **census** — files and lines touching the unit's concept, now vs v4.3.0,
  naming what ARRIVED and what LEFT
- **read** — every source file, against the bug classes the repo has a history
  of: lifecycle/detach-destroy, autoruns writing what they read, fetch races,
  coordinate math, `||`/`??` hiding an undefined state
- **sweep** — `scripts/mutation_sweep.py` at the unit
- **verdict**, one of three, written down: *clean* (no survivors) / *thin*
  (survivors, tests exist but miss cases) / *bare* (no meaningful tests)

Three buckets and no more — the output has to be countable. Note that the read,
not the sweep, is what has produced every finding so far.

### 4. Exit criterion, set now

Eight **random** units sampled; survivors triaged; the deleted source files
walked (done); a one-page spec written for the top three concepts (if it cannot be
written in a page, that is the finding); RC out for two weeks with no P0 from
real users.

If ≥3 of the 8 random draws come back thin or bare, draw 8 more — at that point
it is a survey, not a sample, and the extra cost is earned.

## What is left, in order

1. **Seven more random draws**, starting with `packages/tree-sidebar/src` (4,078,
   the largest outstanding) — these are what the estimate is made of.
2. ~~**The deleted source files.**~~ **Done, and it came back nearly clean.**
   Method, which took 6 seconds once it was the right method: take every name
   each deleted file exported at v4.3.0 (one `git cat-file --batch`, not 769
   `git show` spawns), build the set of identifiers appearing anywhere at HEAD
   **once**, and intersect. A rename or a re-home drops out. Do NOT grep 400-name
   alternations over the tree — that is where a first attempt timed out at ten
   minutes.

   **Pin the command, not the number.** Three sessions produced 853, 841 and 787
   for the file count and none was reproducible, because it moves with rename
   detection and git silently *partially* skips it on a diff this size
   ("exhaustive rename detection was skipped" — and the partial answer is
   neither clean one). Non-test source under `{plugins,packages,products}/*/src/`:

       769   git -c diff.renameLimit=6000 diff -M   --diff-filter=D   (renames excluded)
       792   git                          diff --no-renames --diff-filter=D

   Use `-M`: the difference is files that merely moved. It is still an
   over-count — `-M` sees a file that moved, not one split in three.

   The funnel, and why the answer is reassuring:

       769 deleted files  →  951 exported names  →  645 appear NOWHERE at HEAD
                          →  70 of those were named by a public entry file at v4.3.0

   Of the 70, the upgrade guide already covers the great majority **by class
   rather than by name**, which is the right editorial call: "The renderer
   registry is gone" accounts for ~40 (`XYPlotRenderer`, `DensityRenderer`,
   every `*RendererF`), "The `lollipop` plugin was removed" for 4, and the
   generated ABI-removals block for the `@jbrowse/core/*` names.

   **The residue is six RPC method names** — `WiggleGetGlobalQuantitativeStats`,
   `WiggleGetMultiRegionQuantitativeStats`, `MultiWiggleGetSources`,
   `MultiVariantGetSources`, `MultiVariantGetGenotypeMatrix`,
   `MultiVariantGetFeatureDetails` — which appear in no source file, no doc and
   no JSON at HEAD, and which the guide's only two RPC mentions do not reach. An
   RPC method is called by string, so this is a surface of its own. It is *not* a
   fourth quiet-failure surface, which was worth checking rather than assuming:
   `BaseRpcDriver` reads `pluginManager.getRpcMethodType(name)` and immediately
   calls `.serializeArguments`, so an unknown method throws
   `Cannot read properties of undefined` — loudly, but without ever naming the
   method it could not find. Filed to [TODO.md](../TODO.md).

3. **The one-page spec per concept**, which is the only part of this plan that
   asks whether the shape is right rather than whether the tests pin it. The
   gate's is written — `reference/REGION_TOO_LARGE.md` § the collapse above the
   test list — and the method transfers: enumerate the leaves, group by what a
   consumer can tell apart, and report both counts. Two concepts left.

## What this deliberately does not cover

- **Design.** Mutation testing proves the tests pin the code. It says nothing
  about whether four gate axes plus a staleness dimension is the right shape.
  Only the one-page spec per concept asks that — and for the gate it has now
  been asked and answered: seven outward states, and the axes are how they are
  reached rather than states of their own.
- **Emergence.** Unit-level mutation says nothing about subsystems interacting.
  Daily use covers some of it; the RC covers the rest, on other people's data.
- **API surface diffing against v4.3.0**, considered and dropped: the release is
  used daily and back-compat is not the worry. Note this was dropped one level
  too early — it is third-party *plugin* ABI, not user back-compat, that the
  session and barrel removals above put at risk.
