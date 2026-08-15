#!/bin/bash
# Verdict flips for the `screenshot-review-bad` branch's pass over the nine
# `bad` items, to be run FROM THE PRIMARY CHECKOUT once the branch has landed.
#
# They are not on the branch on purpose: a worktree does not share the review
# server's lock, and a branch carrying screenshot-review.json makes the ff-only
# landing refuse against a reviewer's dirty copy. See screenshot-review-plan.md,
# "Shared worktree".
#
# `answered` where the note is a reply rather than a change, `good` for the
# rest. Two stay `bad` and their blocks say why.
#
# NO BACKTICKS INSIDE A NOTE. They are double-quoted here, so a backtick pair is
# command substitution and the words between it vanish from the note the
# reviewer reads — silently, apart from a "command not found" in the run's own
# output that scrolls past. It happened once, to two words in the in2lt note.
# Name a symbol bare, or single-quote the whole note.
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/flip-review.ts good alignments/read_cloud \
  "FIXED IN THE APP, and the line swatch was wrong rather than merely
inconsistent. A read cloud's connector takes flatConnectorColor -- the theme
foreground, deliberately given no palette slot 'because the line carries no
category (its endpoint squares do)' -- while the arc palette is indexed by the
endpoint SQUARES. So the line named the one mark in that overlay that is never
drawn in the colour beside it.

arcMark now returns a fill for cloud mode, so all eight rows are square swatches.
Arc mode keeps its curve, where the mark is what the colour is actually on."

node scripts/flip-review.ts good inversion_long_read \
  "ONE SIZE, 18. The track-level pill was 16 against the two section pills' 18,
on the reasoning that it names a setting rather than a finding -- which nothing
in the frame says, so it read as three labels one of which came out wrong. Rank
is already carried by where each pill sits: the setting on the track header, the
findings on their own sections."

node scripts/flip-review.ts good genomes_basics/promoter_regulation \
  "BOTH MARKS ADDED, and the arrow needed a small piece of pipeline.

The morevert is ringed in panel 1. Worth having here beyond the general rule:
the cascade opens over a DIFFERENT track's rows than the one it belongs to, so
the icon that was clicked is four lanes above the first boxed item.

The arrow between the panels is new machinery. annotateComposition -- the layer
that can span two frames -- was compose-only, so a stages figure had nowhere to
put a mark belonging to the PAIR. gridAnnotations is that layer for a stage
grid, with each frame anchorable as data-part=N, and stageGutter widens the seam
so an arrow across it has a run to be seen in (at the 24px default it is a
hairline). Both are general; this figure is the first caller."

node scripts/flip-review.ts good genomes_basics/search_tp53 \
  "FIXED IN THE BROWSER, which is what the note asked for.

geneGlyphMode auto had one reason to hide transcripts -- zoom -- so at a gene
window it resolved to 'all' and RefSeq All laid 28 transcripts inside a 100px
band, with the last rows and the gene's name behind the track's own scrollbar.
auto now also caps a gene at the rows its lane HAS. The middle frame is seven
legible transcripts, TP53's label back in frame, no scrollbar, and a loud chip
reading 'Top 7 isoforms' with All transcripts one click away in its menu.

WHICH seven is the same ranking longestCoding already used -- coding first, by
protein length -- so the cap and the collapse agree at n=1 rather than being two
opinions about which isoform speaks for a gene.

What it costs, since it is a real trade and not free: the track height reaches
the RPC payload again, as a debounced integer row count. pickDisplayConfig took
height OUT of that payload after a drag-resize re-ran the worker per frame, so
fetchAutorun.test.ts now narrows its claim rather than losing it -- a height
change inside one row still refetches nothing, and grow carries no cap at all
(its height is its own content's, which in rpcProps is the loop trap).

The third frame still earns its rows: the cap is the browser's answer to the
height, one canonical transcript is the reader's answer to the question."

node scripts/flip-review.ts good cancer_sv/derivative_synteny \
  "FOUR OF THE FIVE DONE; the strand-colouring one is answered on
cancer_sv/derivative_inserts, where it was raised.

Arc band 45 -> 110. At 45 the three domes clamped to the ceiling and drew as one
flat mass, so the count each carries -- the reason the band is there -- was
unreadable.

Super-compact off, both read lanes, back to the Compact pitch. At 1px a row is a
hairline and the strand colour it carries has nowhere to draw, so the lane cost
its 45px to say only that reads were present.

The der3 row's highlight is gone. You were right about why: it shaded
32,000-33,700 while the fold-back's inverted return runs from there to the end of
the contig, so it pointed at one part of a breakpoint region the row draws all
of.

SAME SCALE, by zooming the bottom as you suggested. A synteny panel gives every
region one bp/px, so matching the rows' TOTAL spans matches them everywhere: the
reference row lays out 13,000 + 2,000 + 2,500 bp and der3 is now 17,549 rather
than 39,549. Every ribbon runs near-vertical instead of fanning 2.3x on the way
down. It costs the first 22 kb of the 32.7 kb arm, which is the half carrying
nothing; the segments lane's labels at the junctions are all still in frame.

The notes below are compressed to the two items still worth carrying."

node scripts/flip-review.ts answered cancer_sv/derivative_inserts \
  "NOT CHANGED, because the note asks for a concept and picking one unilaterally
is how the display got to four strand vocabularies in the first place. What is
worth deciding is smaller than it looks, so here it is laid out.

WHAT IS ACTUALLY ON SCREEN. There are two strand-ish colourings and they are
disjoint by construction, never mixed in one lane:

  - split-read framing (chain mode, unpaired): a segment agreeing with its
    chain's consensus frame is red, one flipped at the junction is blue.
    'Split segment (same strand)' / '(inverted)' in the key.
  - paired split markers (chain mode, paired, orientation scheme): magenta for
    an inverted junction, orange for a co-linear one.

The first is what the top figure shows and what the derivative lane shows.

YOUR SECOND QUESTION ANSWERS ITSELF, and it is the one I would act on: the
derivative lane does NOT benefit from it. Those reads are realigned to the
reconstructed allele, where the fold-back has been straightened out -- so every
segment agrees with its frame and the whole lane is one colour. It is spending a
colour channel to say nothing. Say the word and it goes to the neutral scheme,
leaving red/blue meaning 'flipped at a junction' on the reference lane alone,
which is the only place it is ever true.

ON A DIFFERENT PALETTE: available and cheap (colorSplitReadInversion and the
strand pair are theme slots), but it moves every alignments figure in the repo,
so it wants its own review round rather than riding this one.

ON THE LEGEND SITTING ON THE DATA: real, and I started a placement setting for
it and backed it out -- it is a product decision, not a figure fix. The lever
that exists today is the window: FloatingLegend is pinned top-right with an
opaque background and no placement slot, so the only way to clear the corner is
to carry the data a few kb short of the right edge. Worth a proper decision
separately."

node scripts/flip-review.ts answered ld/lct_pooled_vs_panel \
  "YES -- with one reservation, which is the figure's subject rather than its
execution.

What the last round fixed is holding: all three lanes name their samples, so no
row is about a set the frame never identifies, and the tutorial says why the
panel is the one that matters.

The reservation: this figure argues by ABSENCE. Its point is that pooling
populations the haplotype never reached averages the correlations down, and what
a reader sees is one lane bright and one lane not. That is a fair reading and it
is also the shape you have denied elsewhere as 'no story' -- it works here only
because the Fst lane underneath says independently which samples the sweep is
in. If it ever reads thin again, the fix is that third lane, not the two the
figure is named for."

# STILL BAD. The travel cap landed (its own commit, on main) and the flat line
# is gone, but the zoom half is blocked on an app bug, so this keeps its verdict
# rather than being flipped on half an answer.

# hg002_haplotypes_location_markers: see the block above -- the zoom-out is
# declined with a measurement (this window's 141 chain gaps are nearly all under
# 50 bp, so wider is smaller), the locus that WOULD deliver it is scored and
# named in the spec, and it cannot be used yet: the synteny RPC throws
# DataCloneError 'ArrayBuffer at index 19 is already detached' there at any
# window width, reproducibly, and the whole band renders as an error banner.
# Deduping the hand-maintained transfer list was tried and is NOT the cause --
# the buffer is detached before the post, so something is holding a typed array
# across calls. That is the next thing to find; the figure is unchanged and its
# flat line is already gone.
#
# pangenome/rgfa_hover_sync: the note asks for three things and the third one
# ("the MAF track says nothing about a 65kb insert so this is a mystery to user
# where this came from") is a data question, not a callout question -- the MAF is
# a projection that cannot represent an insertion absent from the reference, so
# answering it means either a different track or saying so on the page. That is
# a figure rebuild rather than a pass, and it was not reached in this round.
