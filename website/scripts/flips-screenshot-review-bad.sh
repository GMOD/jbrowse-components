#!/bin/bash
# Verdict flips for the `screenshot-review-bad` branch's pass over the 14 `bad`
# items, to be run FROM THE PRIMARY CHECKOUT once the branch has landed.
#
# They are not on the branch on purpose: a worktree does not share the review
# server's lock, and a branch carrying screenshot-review.json makes the ff-only
# landing refuse against a reviewer's dirty copy. See screenshot-review-plan.md,
# "Shared worktree".
#
# `remove` for the retired figure, `answered` where the note is a reply rather
# than a change, `good` for the rest. Thirteen of fourteen; hg002 stays `bad`
# and the last block says why.
#
# NO BACKTICKS INSIDE A NOTE. They are double-quoted here, so a backtick pair is
# command substitution and the words between it vanish from the note the
# reviewer reads — silently, apart from a "command not found" in the run's own
# output that scrolls past. It happened once, to two words in the in2lt note.
# Name a symbol bare, or single-quote the whole note.
set -euo pipefail
cd "$(dirname "$0")/.."

# `remove` takes no note (it deletes the entry), so the reason is here: spec,
# the tutorial section that carried it, its lock line and the PNG are all gone.
# The two whole-chromosome figures above it already place the 4AL/5AL junction,
# so the page runs from the urartu comparison straight into the conversion.
node scripts/flip-review.ts remove orthofinder_synteny/wheat_4a_breakpoint

node scripts/flip-review.ts good homoeolog_synteny/wheat_vs_oat \
  "SELF-ALIGNMENT throughout: both overlay titles, both DotplotView displayNames,
the caption and the sentence introducing the figure. The page's own TL;DR
already said it, so this is the frame catching up with the prose."

node scripts/flip-review.ts good cancer_sv/k562_bcr_abl_split \
  "BOTH. The legend's arc section says Split alignment (inverted) / (same strand)
/ (interchromosomal) -- SPLIT_JUNCTION_LABELS is the overlay's own wording table
so both existing rows moved together, and the interchromosomal row is new there:
CATEGORY_LEGEND names that category for reads and arcs alike, and its bare
'Inter-chromosomal' is a property of the pair rather than of the mark. On a curve
the mark IS the split alignment. The read-fill rows keep 'Split segment', which
is the distinction the two legend headings already draw.

readConnectionsHeight 35 -> 90. At 35 this frame's two junctions had domes close
enough to read as one mark stepping over the middle panel; they are separately
weighted now, which is what the frame is comparing. viewportHeight follows to
1816, the 25.3 css px the run reported newly below the fold.

Three other figures moved on the rename alone and were re-pushed:
alignments/read_cloud and inversion_long_read key split rows,
cancer_sv/derivative_inserts keys the interchromosomal one. Found structurally
(every spec carrying both showLegend and a connections mode) rather than by
pixels, since a label edit moves no coloured pixel."

node scripts/flip-review.ts good cancer_sv/k562_fusion_inspector_reads \
  "Same two, same mechanism -- see k562_bcr_abl_split for the wording table and
why the interchromosomal row is new. Here the band carries one junction, so the
90 px is purely about the arc reading as a dome rather than as a bump on the
coverage floor, and that arc's stroke width is the figure's headline number."

node scripts/flip-review.ts answered gallery/inverted_duplication \
  "NO for these arcs, and the count is the reason rather than the principle.
Feet would land on the baseline, as you say -- and this frame draws ~278 arcs
across 3000 px (non-white runs along one scanline of the band), so that is ~556
marks 20 px long on one horizontal line five pixels apart. A rule under the band,
not a set of directions.

The other count: orientation on a pair arc is already the colour. Green LL, navy
RR, magenta split inverted, all three named in the legend in this same frame, so
a foot restates a row of the key. That is the existing scope rule read from the
other side -- the interchromosomal family gets feet because its colour channel is
spent, every such connection painting one colour whatever colorBy says.

YES for the interchromosomal TICKS, which is the half worth doing and was already
filed: agent-docs/TODO.md, 'Give the interchromosomal ticks breakend feet too'.
A tick has no second endpoint to read an orientation off at all. It is a
GPU/Canvas2D pass rather than the SVG overlay the arc feet live in, so it needs a
per-instance attribute, shader geometry, the Canvas2D mirror, the SVG export and
a hit-test decision -- about a day, nothing blocking it.

Both halves are now written next to the scope rule in
plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md rather than only here."

node scripts/flip-review.ts good genomes_basics/phylop_tp53 \
  "You are right that nobody cares about the UTR, and it was doing the job of a
control with nothing to be a control FOR: the peaks beside it were unnamed, so
the only reading the frame supported was a fact about phyloP rather than about
TP53.

Exons 5-8 are shaded and labelled now. R175, G245, R248, R249, R273 and R282 all
sit in that block, phyloP is high across all four exons, and the callout leads
with the use: where a variant falls in TP53 changes what conservation says about
it. The 3' UTR stays shaded as the other end of the same question -- a fully
transcribed exon a few kb away with no signal. Neither block reads as a result
without the other in frame.

Bounds are exon 8's start to exon 5's end for NM_000546.6 off
api.genome.ucsc.edu, not eyeballed. The zoom figure two sections down lands on
exon 7 of this block, so the page names one thing twice instead of 'the 3' UTR'
and then 'the DNA binding domain'."

node scripts/flip-review.ts good inversion_pair_orientation \
  "REFRAMED AS AN OPERATION, and four tie lines carry each read from the carrier
to where it lands once the segment is turned back. The second row is 'Flip the
segment back / and the same two pairs straighten out'.

Two lines run straight down, being outside the segment; the two inside CROSS,
which is the mechanism in one mark -- the green pair's right end and the navy
pair's left end trade places and turn around, and that is what leaves each pair
pointing at its own mate. The tie lines are drawn before both rows so the genome
bars occlude them and each reads as passing behind the sequence.

The overlap label moved left of its marker and the crossing pair's control points
hold them vertical out of row 1, both to keep the corridor clear of text rather
than route around it. 410 -> 470 px."

node scripts/flip-review.ts good rpc_lifecycle \
  "EVERY LABEL IS A NAME NOW. The four lines on serializeArguments(), the two on
deserializeReturn(), execute()'s 'read the args off deserializeArguments(), not
off the raw args' and the transferList form of a return are all already on the
page in their own sections, so the cut loses a reader nothing. Title is 'One RPC
call across the worker boundary'. ranksep 1.1 -> 0.8, which the shorter crossing
labels allow: 1453x731 -> 1283x699 and half the bytes.

You offered a simplified figure beside an extended one as a fallback and one
short figure turned out to be enough -- a second diagram of the same five nodes
would make a reader diff them.

AND THE GENERAL NOTE IS NOW A RULE, in website/CLAUDE.md next to the caption
rules: say the thing, don't set it against the thing it isn't. It is stated as
separate from docs/CLAUDE.md's 'don't argue with the previous version of the
page', which only fires on corrections -- this one fires on first drafts and in
titles, which is where you kept finding it. The corollary about diagram labels
being names is beside it."

node scripts/flip-review.ts good popgen/in2lt_inversion \
  "It was drawn and it was clipped. chr2L is the FIRST region of the row above,
so the wedge's narrow end starts at x 12 and its wide end at x 0 -- a
near-vertical line running off the left edge of the image. Correct geometry with
nowhere to be.

ComposeSpec has a sideMargin now, the mirror of the gutter that exists so the
wedge's two HORIZONTAL edges are not the same line. 60 px each side puts it
inside the frame. It moves each part's box so annotateComposition reads it too;
the '19 In(2L)t carriers' arrow still lands on the carrier block, which is the
check that says so.

The slant stays slight because that is the data: the panel below is the left end
of the row above, not a slice out of its middle."

node scripts/flip-review.ts good ld/lct_haploblock \
  "THREE PILLS TO TWO, AND EVERY MARK POINTS AT SOMETHING.

All three were anchored at chr2:134,470,000, which is x 42 css px -- inside the
dendrogram-and-population gutter, so each sat on the sidebar it was meant to be
beside. That gutter measures 107 css px here; the clade pill now starts at 149.
The sidebar is clear.

'Everything else: no shared block' is the second line of the clade pill, and the
second ARROW is what identifies it: two heads out of one box, one into the clade
and one into the mosaic under it. Same statement, one box, both ends named on the
picture instead of in a stack of text. The stripe pill moved to the ClinVar lane
-- the one genuinely empty band here, its jexl filter leaving two marks, both at
the stripe -- sitting directly over what it names with an arrow across the gap.

YOUR TWO QUESTIONS, both no for this figure. The display's levers are already all
pulled: phased rendering (a diploid row would average a carrier chromosome with a
non-carrier one), clustering over clusterRegion rather than the drawn window, the
0.35 MAF floor that keeps the slab out of rare-variant speckle, colorBy
population for the stripe. What is left is row count and height, both argued in
the spec against 1.73 px a row.

Ancestry painting would work against the finding: it answers 'which population
did this segment come from', which is the wolfdog page's question, where here
every haplotype is human and the clade is a young sweep haplotype rather than an
introgressed one. The population stripe already carries the part of that which is
a RESULT -- the clustering is given no knowledge of rs4988235 and the clade it
finds is the one whose stripe is CEU and FIN."

node scripts/flip-review.ts good ld/anopheles_2la \
  "Happy with the design -- two populations at one locus, each panel over the
genotypes it was computed from, the second one white, which is the control the
first needs. Not with one thing in it, which is now fixed.

Gabon's five heterozygotes are the last five of its 69 rows, the lane being
grouped in dosage order, so their band is the lane's own bottom edge: 12 px of
blue lying against the app frame's border. The spec already recorded that it is
not cropped and that it looks cropped, which is worse than cropped -- a reader
who takes it for a clip discounts the sentence above it, and that sentence is the
whole reason the Gabon panel is allowed to be white.

An arrow settles it, and does the job the callout's parenthetical was doing, so
that sentence gets its own line back and stops describing a position. Head at
fracY 0.94, the band's centre rather than the border it sits on.

Nothing else moved: the remaining white is argued in the spec against two
alternatives that were rendered and rejected, and the Gabon panel's emptiness is
the finding rather than slack."

node scripts/flip-review.ts good pangenome/hprc_whole_chromosome \
  "The graph pane cannot show complex structural variation and should not be
asked to: the tier is one node per bubble in reference order, so it IS a path and
every branch was collapsed when the tier was built. The complex variation is what
the fine-index figures higher up the page draw. What this frame is FOR is finding
them, and nothing in it said so.

A lane of the three chr1 loci the page opens -- the amylase bubble, the 1q21.1
inversion, the CFHR3/CFHR1 deletion -- on the same axis as the curve, with their
own coordinates from the constants those figures use. A FeatureTrack rather than
a highlight: at 178 kb per css px the widest of the three is 0.7 px, so a shaded
band would be a hairline with a floating label.

WHAT IT DOES NOT CLAIM, because I checked and it is false: that these are the
peaks. Ranked by segment count over all 9,444 chr1 bubbles they are 50th, 77th
and 155th -- the top 2%, not the top 5, and the chromosome's biggest bubble by a
factor of ten is at 2.65 Mb and this page never opens it. So the prose says the
coarse view narrows a chromosome to a few dozen candidates, which is what it
does."

node scripts/flip-review.ts good pangenome/rgfa_paa_bubble \
  "THE PILL IS GONE AND BOTH ISLANDS ARE SHADED. The frame had one shaded block,
on K-12, over a blank band -- which reads as a deletion -- and everything
correcting that was in the textbox.

Each strain's island is shaded in its own row now and labelled with what it
carries. Two marked blocks with no ribbon between them IS the substitution, so
the pill went rather than being reworded.

The bounds come from the alignment: Sakai's chain to K-12 ends at K12 1,419,704
and resumes at 1,474,096, and Sakai's own island is those two carried through its
two block offsets -- 54,392 bp of K-12 against 69,204 of Sakai, which is why the
band is blank read from either side. The K-12 shade moved off s502's 21.8 kb span
onto the island itself; the ring still marks s502 inside it, so the three objects
that shade used to tie together are now shade, ring and node.

What the picture still cannot say stays on the page: which genes, that seven
symbols are shared across the two spans, that Sakai's island is the longer."

# hg002_haplotypes_location_markers stays BAD. The tick rule you cleared is
# implemented and unit-tested (the cap is one view width, which is exactly 'both
# ends could be on screen at once'), but the figure CANNOT BE RE-CAPTURED: every
# hg002_haplotypes_* figure currently dies with
#   DataCloneError: ArrayBuffer at index 19 is already detached
# out of the synteny RPC. Confirmed pre-existing on main by reverting the change
# and rebuilding; not a duplicate within one transfer list (a Set was tried and
# the failure did not move); not universal to synteny, since rgfa_paa_bubble
# renders. Filed in agent-docs/TODO.md with what is ruled out and the first move.
# So the zoom-out half is untouched and whether the cap removes THAT line is
# unverified.
echo
echo "hg002_haplotypes_location_markers deliberately left bad -- see the comment above."
