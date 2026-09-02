---
name: sample-the-seven-remaining-random-release-validation-units
description: the release-validation estimate is made of eight random draws and one is done; the other seven are the whole estimate, and the order is pre-registered
metadata:
  area: release validation, tests
  category: ready
  order: 7
  first_move: "read `git status` first — a worktree that ran a sweep is dirty until proven otherwise. All seven draws are still outstanding, but `packages/tree-sidebar/src` is half done: its census and read are in the 2026-09-02 section, so resume that unit's sweep with the command there rather than restarting it"
---

# Sample the seven remaining random release-validation units

The estimate that `v4.3.0..HEAD` is safe to release rests on eight
churn-proportional random draws, of which **one is done**
([reference/RELEASE_VALIDATION_SAMPLING.md](../reference/RELEASE_VALIDATION_SAMPLING.md)).
The three risk-ranked units also finished are not part of the estimate and never
were — a unit picked for being under-tested coming back thin is what that
ranking predicts.

The protocol is fixed at ~1 hour per unit (census, read, sweep, one of three
verdicts) and both scripts are committed, so this is execution rather than
design. Take them largest first:
`packages/tree-sidebar/src` (4,078 churn),
`plugins/alignments/src/LinearAlignmentsDisplay/renderers` (2,382),
`plugins/alignments/src/LinearAlignmentsDisplay/menus` (2,329),
`plugins/variants/src/LinearMultiSampleVariantDisplay/components` (2,269),
`plugins/variants/src/LDDisplay/components` (2,004),
`plugins/maf/src/MafAddTrackWorkflow` (508),
`plugins/linear-comparative-view/src/LinearSyntenyView/util` (503).

**Do not redraw, and do not substitute.** The set is pre-registered; picking a
different unit after seeing a result turns an estimate into a search.

**The frame's HEAD is not today's, and the gap is growing.** The frame and its
draw were built by `73ed883192` on 2026-08-21 — "`v4.3.0..HEAD` is 12,714
commits" is that HEAD — and 1,229 commits have landed since (checked 2026-08-29),
63 of them inside the seven units still owed. That does not license a redraw,
which would defeat the pre-registration for the reason above. It bounds the
CLAIM: what eight clean draws support is a statement about the tree as of the
draw, and everything after it is outside the sample. Say which HEAD when quoting
the result, and expect the gap to be the argument for a second round rather than
a reason to re-run the frame.

**First move: read `git status` in the worktree before anything else.** A
worktree that has run a mutation sweep is dirty until proven otherwise, and one
sweep already ended leaving a plausible-looking `||` → `&&` in the tree. The
reference doc's tooling section carries the rest of what a sweep gets wrong,
including the two rules that decide whether its verdicts mean anything at all
(green baseline first, one sweep per worktree).

Record each verdict in the reference doc's random-sample table. The exit
criterion counts that table only: ≥3 of 8 thin or bare means drawing eight more.

## State on 2026-09-02

### `packages/tree-sidebar/src` — census and read done, sweep not scored

**Census.** The package did not exist at v4.3.0: the concept lived twice, copied
between variants (`shared/components/TreeSidebar.tsx` 298, `SvgTree.tsx` 48,
`shared/treeDrawingAutorun.ts` 169, `shared/makeSidebarSvg.tsx` 45) and wiggle
(`MultiLinearWiggleDisplay/components/TreeSidebar.tsx` 299, `SvgTree.tsx` 48,
`treeDrawingAutorun.ts` 167, `makeSidebarSvg.tsx` 49, `treeTypes.ts` 44), with a
vendored `d3-hierarchy2` under `plugins/variants/src` (34 files) and
`VariantRPC/executeClusterGenotypeMatrix.ts` (56). All of that LEFT. What
ARRIVED is the package: 94 files / 11,193 lines at HEAD (59 source, 35 test),
consumed by canvas, maf, variants and wiggle; 86 files / 10,093 lines at the
frame HEAD `73ed883192`, and 30 commits touched the unit after it. The unit is
the top-level directory only (the frame and the sweep are both one level deep):
38 source files there, 102 mutants across 23 of them.

**Read** (every source file, against the five bug classes): no proven bug. The
three autoruns guard on `isAlive`, write only after their awaits or through
actions, and `setupRunClusteringAutorun`'s `applying` flag closes the re-entry.
`clusterProvenanceOverlap` compares `refName` with `===`, and that is sound only
because `locStringsToRegions` canonicalizes on the way in — checked. Two
convention findings, not bugs: `useClusterRun` and `clusterDialog/types.ts` type
their model `IAnyStateTreeNode` (CLAUDE.md says never), and
`setupRowSortAutorun` validates `spec.refName` but not `spec.pos`, so a frozen
`sortRowsBy` with no `pos` never satisfies `regionCoversColumn` and sits in the
snapshot forever — the exact failure the refName check there was added for, one
field over. `rowRuns`, `hierarchy`, `spatialIndex` and the row-sort predicates
all have colocated tests.

**Sweep: zero mutants scored.** Three things stopped it, in order:

- the committed naming oracle selected **748** test files, because the
  basenames `index` and `types` (0 mutants between them) match nearly every
  test in the tree. Fixed in `scripts/mutation_sweep.py` (those two basenames
  are skipped, and the grep is restricted to packages that can import the
  unit); the same 23 files now select 54;
- with those two dropped the baseline was still **421s and red**:
  `products/jbrowse-web/src/tests/VcfCluster.test.tsx` (164s, matched on the
  one word `hierarchy`) timed out at 90s under the load of the other unit's
  sweep running on the same machine, and
  `HierarchicalTrackSelector.test.tsx` (59s) matched on the same word. The
  package-dependency restriction drops both;
- the two sweeps shared one session scratchpad and both wrote `sweep.log`, so
  the other run truncated this one's output — including its exit-1 reason. A
  `pkill -f mutation_sweep.py` this session ran at ~03:58 was machine-wide and
  may have reached the other worktree's run; its log showed a fresh start at
  04:07.

**To resume**, from a clean `git status` in this worktree (the tree is clean
now; the sweep may have been launched at hand-off and is restoring on exit):

    python3 scripts/mutation_sweep.py packages/tree-sidebar/src \
      > /private/tmp/claude-501/-Users-colin-src-jbrowse-components/a026cf72-c8ab-4647-a5e8-ac357d15cb96/scratchpad/sweep-tree-sidebar.log 2>&1

`--start N` resumes; the mutant numbering is the `--list` order. Expect ~60s a
mutant with the narrowed oracle, so ~1.5h for the 102. Then write the verdict
into the reference doc's random-sample table quoting `73ed883192`.
