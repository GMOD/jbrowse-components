#!/bin/bash
# Verdict flips for the 2026-08-16 pass over the twenty `bad` items, to be run
# FROM THE PRIMARY CHECKOUT once the branch has landed.
#
# They are not on the branch on purpose: a worktree does not share the review
# server's lock, and a branch carrying screenshot-review.json makes the ff-only
# landing refuse against a reviewer's dirty copy. See screenshot-review-plan.md,
# "Shared worktree".
#
# `answered` where the note is a reply rather than a change, `good` for the
# rest. What is still open keeps its verdict and says why in a comment.
#
# NO BACKTICKS INSIDE A NOTE. They are double-quoted here, so a backtick pair is
# command substitution and the words between it vanish from the note the
# reviewer reads — silently, apart from a "command not found" in the run's own
# output that scrolls past. Name a symbol bare, or single-quote the whole note.
set -euo pipefail
cd "$(dirname "$0")/.."

# ---------------------------------------------------------------- app fixes

node scripts/flip-review.ts good customized_feature_details \
  "FIXED IN THE APP, and the shading was wrong rather than merely ugly. The
fetch buffers half a viewport either side and the packer places every buffered
feature, so a window holding nine genes can carry a stack twenty rows deep whose
bottom rows draw nothing in view. The scrollbar and the edge shadow are two
readouts of one number, and measured over the whole pack they answered 'features
are hidden below' about a track showing all of them -- and offered a scroll
gesture onto blank canvas.

scrollExtentMaxY measures the same on-screen set the fit ladder already
measures, on the same 500ms coarse debounce, so a pan re-measures once it
settles. Fit mode was already narrowed at the source. The DRAWING height is
untouched, so a buffered feature keeps its box and its label and is unreachable
rather than clipped.

Three figures in this pass came back for it; this is the one where nothing was
below the fold at all, and its bottom band is now the same white as the rest of
the track."

node scripts/flip-review.ts good edit_track_settings \
  "FIXED IN THE APP. A callout box rings its element from OUTSIDE, which needs
room the viewport edge does not have: the settings drawer is docked flush right,
so three of the box's four edges were off frame and the fourth read as a red
line in the page margin -- exactly the 'border on outside of element' you named.

Each side now clamps to the stroke's own half-width, so the pad goes outward
where there is room and inward where there is not, and the whole line lands. A
box with room around it is unchanged, which is every other boxed figure in the
repo."

# ---------------------------------------------------------------- figures

node scripts/flip-review.ts good track_menu \
  "ONE FRAME. You were right that the second frame contained the first: the
menu hangs off the very icon the top frame was ringing, so opening it before the
shot lets all three marks share one picture -- a ring on each of the two places
the menu lives, and a box on what they open. 2400x2720 to 2400x1080."

node scripts/flip-review.ts good scatac/pbmc5k_marker_swap \
  "400px of multi-wiggle to 300, 25px a row. The peaks are narrow and the lanes
mostly empty between them, so the height above this was spending itself on the
flat parts rather than on the marker peak that has to be comparable across the
two columns. The swap still reads: CD8A in the four CD8-expressing rows, MS4A1
in the two B rows."

node scripts/flip-review.ts good cnv1000g/ugt2b17_biallelic \
  "THIS ONE'S SHADOW WAS HONEST, so the fix is the lane rather than the app. The
80px gene track really did hide rows -- a UBX pseudogene and an uncharacterized
LOC packed under the named genes, with a third row clipped at the fold. A type
filter drops them and leaves TMPRSS11E, UGT2B17 and UGT2B15 on one row with
nothing below.

showOnlyGenes was rendered and compared first, since it is the obvious reach:
its gene-like set admits 'pseudogene' by name, so the frame came back
pixel-identical with a 'One isoform' chip added. The config slot rather than the
runtime override, too -- the override is the user's own Filter by..., which the
narrowing count would draw chrome for."

node scripts/flip-review.ts good dog10k-size-fst-scan \
  "A NUMBERED BADGE ON EACH HALF. The zoom panel showed a window with a
highlight in it and nothing said the window was the scan's IGF1 point; a badge
beside that point and its twin on the highlighted peak carries the link. Both
are locus-anchored inside their own part, which a wedge across the seam could
not be -- a composition is a flat image with no view model to resolve a locus
in.

The gene lane's scroll shading is gone with the app fix (see
customized_feature_details): its deeper rows were all fetch buffer."

node scripts/flip-review.ts good ld/lct_haploblock \
  "BOTH HEADS MOVED LEFT, 135.9 to 135.76 Mb, and you were right about the
direction. Measured off the capture against the highlight, whose edges are known
in bp: the clade's unbroken slab runs about 135.73-135.97 Mb, so the old anchor
was inside it but within an arrowhead's length of where it stops -- and an
arrowhead is drawn short of its anchor, so both landed on the edge rather than
in it. The new x is left of the LCT/MCM6 stripe, in the part of the slab no
highlight tints.

They share one column on purpose: the claim is about ROWS, so two heads in one
column of the matrix say it and two heads at different columns would not."

node scripts/flip-review.ts good orthofinder_synteny/wheat \
  "EACH PILL IS ON ITS ROW NOW, WITH THE ROW LABEL RINGED. Both were dropped
60px into the margin below their row label, which put them in the BAND under the
row rather than on it -- and a band is a pair of genomes, so 'A genome donor'
read as naming urartu-to-timopheevii, which is not what it says. On the row's
own line beside a boxed label, each pill names one genome."

node scripts/flip-review.ts good orthofinder_synteny/vertebrates \
  "THE PILL CARRIES THE RESULT NOW, not just the event's name: each gar
chromosome lands on two in zebrafish. The band's shape IS that result and a
reader who does not already know the duplication cannot get from one to the
other -- every other band in the stack is one row's chromosome onto one
partner's, and this one is each gar chromosome arriving at two places."

node scripts/flip-review.ts good display_type_default_badge \
  "A RED PILL SAYING WHAT THE RING MEANS: this track follows a session-wide
default. The ring alone pointed at a 16px glyph and left the reader to work out
what it was.

Anchored to the add-track button rather than to the badge, and that is placement
rather than pedantry: every row left of the badge is a track name, so a pill
reaching for it covers the list it is about. The button sits below the last row,
where the panel is empty."

# ---------------------------------------------------------------- answered

node scripts/flip-review.ts answered cancer_sv/split_view_from_breakend \
  "NEITHER, and the overlap is one drawing rather than one figure. What the two
share is the three-panel split view of chr3/chr10/chr12. What they claim is
disjoint:

  - this figure claims the three panels come out of the CALLSET, from one BND
    record plus the walk that leaves each end by a co-located junction. Its
    subject is the route, and the result frame is what the route produced.
  - realigned_reads claims the same molecules are torn in four against hg38 and
    whole against the derivative. Its subject is the reads, and its left half is
    the reference alignment those reads are being compared FROM.

Delete either and the page loses a claim the other never makes. They also sit
200 lines apart, under sections that are about different things.

The nearest real simplification is the step frames, and it was considered and
declined: the menu frame and the dialog frame are the only place the route is
shown, and the last round asked for exactly those to be numbered so the flow
reads. Say the word and the menu frame goes -- right-clicking a record and
picking a named row is close to what the sentence beside it already says."

# ---------------------------------------------------------------- still bad
#
# Not reached this pass. Each keeps its verdict rather than being flipped on a
# partial answer.
#
# chromhmm: "labelColors are kind of chaotic. what is encode2012." The second
#   half is answerable from the build script (the sidebar stripe is Roadmap's
#   own 19-group vocabulary, and encode2012 is one of its GROUP values) but the
#   first half is a question about whether 19 colours belong on a 127-row
#   sidebar at all, which is a re-plot rather than a caption fix.
#
# pangenome/rgfa_hover_sync: three asks, and the third one ("the MAF track says
#   nothing about a 65kb insert so this is a mystery to user where this came
#   from") is a data question rather than a callout question -- the MAF is a
#   projection that cannot represent an insertion absent from the reference, so
#   answering it means either a different track or saying so on the page. Carried
#   from the previous pass, still a figure rebuild.
#
# ld/lct_pooled_vs_panel: the zoom-out/dual-figure ask needs the Fst lane at two
#   scales, which is a new part plus a rebin, in the shape dog10k-size-fst-scan
#   already has.
#
# cancer_sv/derivative_synteny: "why would the coverage be uneven in the derived
#   allele" is a question about the DATA (the realignment's depth over the
#   reconstructed contig), not about the drawing, and it deserves a measurement
#   off the BAM rather than a guess.
#
# hic/loops_and_domains: "are there any further improvements you'd suggest?"
#   wants a proposal, and the figure is at the end of three rounds of them.
#
# qc/smn_block_and_reads: the two frames exist because a 30x Illumina pileup
#   cannot be drawn across 2.5 Mb -- that part is answerable. "Is there a shorter
#   stretch of poor mappability" is the actionable half and needs the Umap track
#   queried for a shorter block that still carries a story, which SMN1/SMN2 is
#   chosen for.
#
# multirow/display_types_menu: the two-part ask needs a result frame, which is a
#   new spec (the same RepeatMasker window drawn by the multi-row display) rather
#   than an edit to this one.
#
# hg002_haplotypes_location_markers: unchanged from the last pass -- the travel
#   cap landed, and the zoom half is still blocked on the synteny RPC's
#   DataCloneError at the locus that would deliver it.
