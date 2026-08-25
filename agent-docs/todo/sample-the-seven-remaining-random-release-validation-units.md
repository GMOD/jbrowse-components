---
name: sample-the-seven-remaining-random-release-validation-units
description: the release-validation estimate is made of eight random draws and one is done; the other seven are the whole estimate, and the order is pre-registered
metadata:
  area: release validation, tests
  category: ready
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

**First move: read `git status` in the worktree before anything else.** A
worktree that has run a mutation sweep is dirty until proven otherwise, and one
sweep already ended leaving a plausible-looking `||` → `&&` in the tree. The
reference doc's tooling section carries the rest of what a sweep gets wrong,
including the two rules that decide whether its verdicts mean anything at all
(green baseline first, one sweep per worktree).

Record each verdict in the reference doc's random-sample table. The exit
criterion counts that table only: ≥3 of 8 thin or bare means drawing eight more.
