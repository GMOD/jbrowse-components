---
name: a-polyploid-fan-reads-as-biology-not-a-failed-diagonalization
description: Synteny between species with an ancestral whole-genome duplication is 1:many, so ribbons cross however the rows are ordered and reviewers read grape versus peach as a diagonalization failure. Detecting the fan and marking it would let a caption say the crossings are the triplication.
---

# A polyploid fan reads as biology, not a failed diagonalization

Whole-genome synteny across an ancestral whole-genome duplication is
intrinsically 1:many. Grape's paleohexaploidy is the resident demo
(`grape_peach_synteny`): each peach region maps to about three grape blocks, so
ribbons cross whatever the order, and single-axis `diagonalizeRegions` cannot
flatten it. Reviewers repeatedly read the crossings as a diagonalization
failure; they are real biology.

The within-row orderings
[ADR-034](../../architecture-decision-records/adr-034-dotplot-diagonalize-stays-single-axis.md)
measured cut *transitive* crossings and cannot
remove a genuine many-to-many one.

## The idea

Detect the fan, a query region with M target hits above a length and identity
floor, and make the multi-mapping read as signal:

- a shared hue per source-block family
- an explicit paralog-fan affordance
- a summary "×3" on the region

## The call

Which of the three, if any, judged on grape/peach captures. A copy of the
window on another contig already draws as its own lane in the multiway display
([ADR-278](../../architecture-decision-records/adr-278-a-copy-of-the-window-draws-as-its-own-lane.md));
this is the linear synteny view's and the dotplot's counterpart.
