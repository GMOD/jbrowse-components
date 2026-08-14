---
name: handoff-interchromosomal-read-connection-arcs
description:
  The arcs and the k562 figure landed; what is left is the second junction
  producer that figure retires, two exploratory figures whose render IS the
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
What is left is the second junction producer that retires, two exploratory
figures, and one unverified frame.

## 1. Drop piece A — the figure it was built for no longer needs it

**`cancer_sv/k562_bcr_abl_split` is done and published** (`020ea68664`,
`01307eeead`): the band is on beside the bezier fan, and it renders as the
measurement said it would — one arc of support 26 across the region divider at
the ABL1 exon-2 acceptor, three hairlines under its stroke, and a tick at the BCR
donor for the molecules reaching acceptors outside the frame.
[DEMO_DATASETS.md](../reference/DEMO_DATASETS.md) has the acceptor distribution
behind those numbers and the method caveat.

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

## 2. Two exploratory figures — the render is the measurement

Neither can be rendered before this feature exists, which is why they are here
rather than done. Both are worth rendering **because** we do not know what they
show.

**The frame decides which connections are arcs.** Same chr22 window as figure 1,
chr9 widened to the whole of ABL1 (~`chr9:130,710,000-130,890,000`). The ticks
should become arcs fanning to the distinct acceptors, weighted by support. Paired
with figure 1 it is the clearest statement of the semantic this change
introduces: a tick means "reaches somewhere you cannot see", and widening the
frame turns it into an arc. What is uncertain is what it draws — the acceptor
distribution is solid but the chr22 feet of those out-of-frame junctions come
from CIGARs carrying 100 kb+ `D` operations and are not. **Do not let the caption
claim biology**: whether the 149-read site is an alternative acceptor or an
alignment artefact is unestablished, and the figure's subject is the display
behaviour. If it renders as noise, drop it and record that in `DEMO_DATASETS.md`.

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
