---
name: handoff-interchromosomal-read-connection-arcs
description:
  The arcs and the k562 figure landed; what is left is the second junction
  producer that figure retires, one exploratory figure whose render IS the
  measurement, and the one number the overlay's cap still rests on an estimate
  for.
---

# Handoff: interchromosomal read-connection arcs

**The feature landed** (2026-08-14, five commits ending
`test(browser): three region layouts over one translocation`). A read connection
between two chromosomes now draws as one coalesced, support-weighted arc when
both of its ends are on screen, and as the two ticks it always drew when they are
not; an arc whose feet are in two displayed regions is drawn once across the view
by `CrossRegionArcsOverlay` instead of being handed to both blocks and coming out
as two dangling halves. The reasoning is in the commit messages and in
[`LinearAlignmentsDisplay/CLAUDE.md`](../../plugins/alignments/src/LinearAlignmentsDisplay/CLAUDE.md);
`test_data/volvox/volvox-translocation.bam` and the three `arcs-display` browser
cases are its regression test.

**`cancer_sv/k562_bcr_abl_split` has been re-aimed onto the band and published.**
What is left is the second junction producer that retires, one exploratory
figure, and one unverified frame.

## 1. Drop piece A — the figure it was built for no longer needs it

**`cancer_sv/k562_bcr_abl_split` is done and published** (`020ea68664`,
`01307eeead`, then re-framed onto three regions): the band is on beside the
bezier fan, and it draws the two biggest acceptors as weighted arcs across the
region dividers — the 154-read intronic site and the 26-read ABL1 exon-2 one —
with a tick at the BCR donor for the 37 molecules still reaching outside the
frame. [DEMO_DATASETS.md](../reference/DEMO_DATASETS.md) has the acceptor
distribution behind those numbers and what is and is not established about them.

So the case for `showSplitJunctionArcs` — the counted sashimi overlay on branch
`worktree-split-read-sashimi-arcs`, that thread's "piece A" — is spent. It is a
second coalescer for the same junctions, clustering within 10 bp and taking the
modal site where `arcKey` coalesces on exact coordinates, so at a junction with
microhomology jitter the two print different counts at one locus. The arc band
now draws what it was built to draw, in the figure it was built for.

What its removal loses is the printed count label and the position over the
coverage band, nothing else. The label, if wanted, is a small later option on the
arc band sourced from `ComputedArc.support` — one producer, one number, serving
same-chromosome junctions too. It is not a reason to keep a second junction
producer alive meanwhile.

The clustering pre-pass that would have made the two agree is dead and filed:
[REJECTED_IDEAS.md](../reference/REJECTED_IDEAS.md), "A clustering tolerance
inside `arcKey`".

## 2. One exploratory figure left — the render is the measurement

**The widened-ABL1 frame is done, and it went back into figure 1 rather than
beside it.** It was written up here as a second frame paired with the first, on
the reasoning that the pair states the semantic (a tick means "reaches somewhere
you cannot see"; widen the frame and it becomes an arc). What settled it the
other way is that figure 1 was *wrong on its own*: its window framed the
26-read acceptor and put the 154-read one inside the donor's tick, so the
published figure understated its own data by six-fold with nothing on screen
saying so. That is a defect to fix, not a contrast to preserve.

Widening chr9 to the whole gene was not the way to fix it — an LGV shares one
bp/px, so a ~180 kb chr9 panel beside a 7 kb chr22 one leaves BCR under 4% of
the width and destroys the read-by-read fan. Three 7 kb windows (donor + the two
biggest acceptors) keep every panel at the fan's zoom and put both junctions on
screen as weighted arcs. The counts and the corrected acceptor distribution are
in [DEMO_DATASETS.md](../reference/DEMO_DATASETS.md); the framing argument is in
the spec comment.

**What is worth knowing before re-framing any figure to shrink a tick**:
`arcLineWidth` caps at 4x the base width around 44 reads, so the donor's bar
draws the same 8 device px at 37 reads as it did at 206. Re-framing changes what
the marks mean, not how heavy that one looks. If the bar itself is the problem,
that is a display question — suppressing a tick whose coordinate already carries
a cross-region arc foot, or marking an off-window partner differently from an
off-assembly one — and neither is done.

**The multihop chain in one view.** COLO829's `chr3:25,357,600-25,361,000` with
the chr12 and chr10 partner windows as further displayed regions, tumour track
with `readConnections: 'arc'`. The hops draw as counted arcs in one LGV. The
tutorial tells this story today with `multihop_split_view` — four panels built by
"Reconstruct derivative allele → draw as split", and a script — so this belongs
beside that figure rather than replacing it. ONT split junctions are exact, so
they should coalesce into a few thick arcs whose width is the support nanomonsv
called on, which is the best case this feature has. Partner coordinates come from
the nanomonsv VCF / `sv_multihop.py` output; the figure only works if those
windows are right.

## 3. Two things still unverified, and one number still an estimate

- **A dark-mode frame.** The overlay strokes from the same palette slot the
  canvas passes resolve, so it should follow the theme, but no frame has been
  looked at. (The SVG export IS verified — `svg-export.ts` exports the two-contig
  view and checks the clip group and the stroke widths.)
- **The same-chromosome cross-region count at depth**, which is the number the
  overlay's 600-arc cap is sized from and is an estimate scaled from a 30x
  measurement, not a measurement. It is cheap now: read `crossRegion.length` off
  the model on the HG002 300x window split in two. Note the user-facing
  mitigation at that depth already exists and is the one such a reader is
  already using — `drawProperPairArcs: false` drops 9138 of 9204 arcs.
- The prior thread's other numbers, re-read but never re-run: 52 of 381 arcs
  (13.6%) cross-region on the HG02768 inverted duplication split into two regions
  300 bp apart, 0 for that view as one region and for two regions 2 Mb apart, 865
  of 9204 arcs interchromosomal at 1:2,000,000 on HG002 300x.

## The escape hatch, if the overlay's set ever does get big

Written down rather than built. One extra **view-space GPU pass**, reusing
`arc.slang` unmodified: pack the cross-region arcs against layout px instead of
bp (they are the same axis — displayed regions are laid out contiguously,
`calculateDynamicBlocks.ts` advances by `regionWidthPx` with no inter-region
padding except the two boundary blocks, which is also why the SVG overlay lines
up with the canvas exactly), set `blockStartPx`/`blockWidth`/`bpLo`/`bpLen` so
the "bp" axis IS layout px, and set `canvasW` to the **view's** width so
`arcIsFar` is asked once for the whole mark. Scissor to the band over the full
canvas rather than per block.

What it costs: a repack on zoom, a second uniform-fill path, and the split of
"drawn coordinate" from "reported coordinate" that the tooltip needs — the scar
`arcYBp` / `arcSpanBp` already records, one axis over.
