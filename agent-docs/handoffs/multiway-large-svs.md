---
name: multiway-large-svs
description: "MultiWaySyntenyDisplay on HPRC haplotype stacks names and draws the large SVs a source states against GRCh38. All seven fixes have landed (here, and the walk aligner in the graph plugin at 1a19e45, unreleased). Open: release the plugin and recheck the walk track; the piecewise lane frame waits on Colin's call."
---

# Multi-way lanes: large SVs between haplotypes

## Goal

On an HPRC haplotype stack, every large SV a source states against GRCh38 draws
and reads plainly, with no inference: a gap names both its sides, an inversion
is named, inversion carriers stack together, and the header of a lane inside a
long deletion says so instead of the lane drawing blank.

## Where it stands

How the chip, holes, inversions and window deletions work:
[MULTIWAY_SYNTENY_DISPLAY.md](../reference/MULTIWAY_SYNTENY_DISPLAY.md) "Where
things live". Checked on the PIF track of `hprc_multiway` from a dev server,
2026-10-18:

| locus | lanes | chip |
| --- | --- | --- |
| MAPT 1.4 Mb | H2 (HG01123#1) | "870 kb inversion" |
| MAPT 1.4 Mb | HG00133#1, HG00099#1 | "420 kb deletion, 230 kb insertion", hole at the net |
| 8p23.1 5.5 Mb | 7 carriers | "4 Mb" to "5.1 Mb inversion" |
| CFHR3-CFHR1 | 4 carriers | "85 kb deletion" |
| GSTT1 | HG00097#1, HG00099#1 | "54 kb insertion, 37 kb deletion", as the graph track reads |

## Next

1. **Release the graph plugin** with 1a19e45 (`anchorAligner`), so the hosted
   walk track gains FLNA/EMD's 37.6 kb inversion as a reverse record for
   HG00099#2, HG01960#1 and HG01978#1. Then capture the walk track at FLNA
   and MAPT: the chip names FLNA's inversion, and MAPT's H2 lane sits at an
   end of a structure-ordered stack.
2. **Piecewise lane frame, Colin's call**: `RowFrame.turns`, the runs opposing
   the frame's direction, mirrored inside `openedBp`, so an inversion draws
   straight in its lane and the X goes. The pivot sits just outside a turn;
   overlapping seams cut at their midpoint. Same idea as
   [straighten-an-inversion-by-reversing-its-span](../ideas/waiting-on-a-call/straighten-an-inversion-by-reversing-its-span.md),
   deferred 2026-09-24 for LinearSyntenyView rows.
