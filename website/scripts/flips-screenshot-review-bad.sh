#!/bin/bash
# Verdict flips for the 2026-08-16 second pass over the five `bad` items, to be
# run FROM THE PRIMARY CHECKOUT once the branch has landed.
#
# They are not on the branch on purpose: a worktree does not share the review
# server's lock, and a branch carrying screenshot-review.json makes the ff-only
# landing refuse against a reviewer's dirty copy. See screenshot-review-plan.md,
# "Shared worktree".
#
# All five were UNCHANGED by the hash triage, i.e. genuinely still open, and all
# five are answered with a change rather than a reply.
#
# NO BACKTICKS INSIDE A NOTE. They are double-quoted here, so a backtick pair is
# command substitution and the words between it vanish from the note the
# reviewer reads -- silently, apart from a "command not found" that scrolls past.
# Name a symbol bare, or single-quote the whole note.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/flip-review.ts good chromhmm \
  "NAMES ONLY, and the lane went from eight genes to the whole cluster. This
started life as showDescriptions:false, which has no home on the unified labels
enum, so migrateBasicConfigSnapshot had resolved it to 'auto' -- and 500 kb of
HOXA is low enough density that 'auto' brings descriptions back. So the widest
thing in the lane was 'HOXA cluster antisense RNA 2'.

Pinned to 'name' the same three rows now carry HOXA1 through HOTTIP, both HOXA
antisense rows, MIR196B and both EVX1 rows. That is also what makes the two
boxes readable as what they are: the genes left of the red box are the anterior
half by name now, rather than by taking the label's word for it.

On the wider question, since you asked whether I am happy with it: the 127-row
painting is as dense as it is because 127 rows is the dataset, and the two
things that were chaotic and fixable have both been fixed now -- the key's
stripe order, and this. What is left that I would still change is the 19-group
sidebar vocabulary, which is Roadmap's own and whose alternatives in the same
file are worse (that is the previous round's note). Say the word if you want
that re-plotted rather than defended."

node scripts/flip-review.ts good dog10k-size-fst-scan \
  "BOTH, and the badge turns out to have been a rendering problem rather than a
spec one. It was already gone from the spec last round; what kept it in the
picture is the content-stable gate -- removing a 30 px circle from a 3000 px
capture is under the 0.5% a re-render has to differ by, so the part was skipped
and the composition restacked the old PNG. --force is the answer, and the same
trap is worth knowing for any small annotation edit.

THE WEDGE. Its apex is under three pixels wide, since the lower panel is 2 Mb of
chr15 against 2,229 Mb of row, so where it lands is the whole of its accuracy --
half a percent off and it points at a different chromosome. It is fitted rather
than eyeballed: least squares over the row's own region dividers, thirty-three
of them, every one predicted to within 2.4 px, and the data area it solves for
is the one popgen/in2lt_inversion independently solved for against different
landmarks. Measured back off the finished render, the apex sits within 2 px of
the IGF1 point.

SHORTER: both score lanes 380 to 240, so the figure is 2632 px to 2192 even
after paying 120 for the gutter the wedge lives in. What a Manhattan lane is
read for is a ratio, and the ratio survives a third off the height.

That broke every hand-fitted dy on the scan half, which is the part worth
keeping: those are gone, and a score's y now comes from wiggle-core's own
axisPlotBox. The three peak labels also moved to the SIDE of their points rather
than above them, because the tallest peak sits within 40 px of the axis top at
any lane height, so a pill above it is clipped by exactly the shrink that leaves
the other two alone."

node scripts/flip-review.ts good qc/smn_block_and_reads \
  "ALL THREE.

THE WEDGE, sized off the upper frame's own SMN highlight bands -- four landmarks
whose coordinates are exact, fitted to under 0.8 px of residual. It lands where
a reader can check it, because the block's right-hand edge is in both frames.

MEDICALLY RELEVANT, said on the picture: SMN1, biallelic loss causes spinal
muscular atrophy. That was the gap. Every lane in both frames says something
about mappability and none of them said why anyone sequences here, so the locus
read as chosen for being hard. SMN1 alone rather than the pair, because SMN2 is
900 kb away and outside the read frame; its copy-number-modifier role is in the
prose beside the frame that shows both.

COMPRESSED: 3330 px to 3110, with the two frames themselves down 170 css px
between them and the gutter costing 60 back.

The pileup's share of that is height alone, and featureHeight is not a lever
here -- it was tried and reverted. At 464 bp a pixel a 150 bp read is a third of
a pixel wide, so the compact preset's extra rows are the sparse tail of the pack
rather than more field: the MAPQ block came back a picket fence over white.
Shorter at the default row height keeps every drawn row inside the dense part,
which is the thing being read."

node scripts/flip-review.ts good hic/loops_and_domains \
  "BOTH CORNERS BANDED, which is the version of 'make the message obvious' that
lets the data say it. The frame had no callout at all: the section defines a
contact domain and a loop in prose, the figure drew one of each, and which one
was left to the caption -- with six Arrowhead arcs, four HiCCUPS arcs and more
than one block in the matrix, including a denser one left of MYC that is a
different domain.

The two bands are the domain's own corners, drawn by the view rather than the
overlay, so they are columns through every lane. The Arrowhead arc's feet, the
HiCCUPS arc's feet and the matrix block's two corners all land on them, which is
the section's claim made checkable instead of asserted. The left corner needed no
band of its own: the domain starts within half a kilobase of MYC and the gene's
band was already there, which is also why the ranking was taken to this window.

The pills then say only what no lane can -- that those two columns are one
object's ends, and that the arc was called FROM the matrix under it, which two
track names naming the same cell line do not convey.

WHY GM12878, now in the prose, because the page never said: a domain-and-loop
figure needs a matrix whose own published Arrowhead and HiCCUPS calls exist, and
deep enough that a 600 kb block has edges. Worth a reader knowing before they
read the three lanes agreeing as corroboration, since they cannot disagree.

IS IT DIFFERENT IN DIFFERENT CELL TYPES: measured again, and at the level this
frame draws, no -- every one of the twelve lineages is enriched inside the domain
against its flanks, 3.6x for NK to 5.2x for CD4 Naive. That is what the lane is
there to say and the prose says it.

But there IS a real answer one zoom down, which I did not build because you asked
this figure to zoom OUT last round. Per 10 kb site inside the domain the lineages
split: of the fourteen strongest sites, three are myeloid-dominated (~70% of the
bin across CD14, CD16 and cDC) and two are B-dominated (~50-56% across the two B
rows). A 700 kb second frame under this one would show that as peaks present in
some rows and blank in others, which is a genuine negative in the picture. Say
the word and it is the same two-part shape as the other figures in this pass."

node scripts/flip-review.ts good ld/lct_pooled_vs_panel \
  "TAKEN YOU UP ON IT, and the wider calculation pays off by more than the ask
assumed. ld/lct_sweep_two_scales is the figure now: a 40 Mb Fst scan of chr2
above, this frame under a trapezoid below it. Both parts keep their own live
link, so this one is still openable on its own.

scripts/build_lct_fst_scan.sh recomputes the same Weir & Cockerham estimator
over the same panels of the same release, 40 Mb with LCT in the middle.
rs4988235 comes out the highest-scoring site of 977,763, and the ten highest are
all inside the block with it. Of the sites clearing 0.35, sixty-one are in
134-136 Mb and five are in the other thirty-nine megabases. The lane draws that
as one cluster at the top of the axis with nothing else near it.

THE ONE THING THAT DESTROYS IT IS WINDOWING, and I built it that way first on
the reasoning that a 40 Mb scan wants bins the way a Manhattan does. At 100 kb
bins with WEIGHTED_FST the block ranks 58th of 400 windows, behind runs at 121.5
and 151.7 Mb that have nothing to do with lactase. A sweep differentiates the
variants on its own haplotype and leaves the rest of a bin on the background, so
the bin averages the signal away. Not the bin size and not the contrast: the
same slice unbinned puts the block first outright. That negative is recorded at
the top of the build script so nobody re-adds --fst-window-size.

Drawing it needs the opposite adapter setting from the lane below, which pins
resolutionMultiplier to force raw values: 977k points is 650 a pixel, so here
the zoom bin is what makes it drawable and summaryScoreMode 'max' is what keeps
the peak through it. Both lanes share one 0.1-0.5 axis, so the peak is the same
height in each.

The bigWig is deployed to demos/popgen through deploy-demo.sh. Note the prior
round's other offer still stands and was not taken: combining this with the
haplotype matrix figure is a separate column and a separate question."
