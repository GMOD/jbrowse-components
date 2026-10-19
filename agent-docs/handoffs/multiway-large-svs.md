---
name: multiway-large-svs
description: "MultiWaySyntenyDisplay on HPRC haplotype stacks: draw and name what the source states about large SVs against GRCh38 (replacements, inversions, deletions longer than the window), and stack inversion carriers together. Seven fixes in landing order, each with a done-when; the piecewise lane frame waits on Colin's call."
---

# Multi-way lanes: large SVs between haplotypes

## Goal

On an HPRC haplotype stack, every large SV a source states against GRCh38 draws
and reads plainly, with no inference: a replacement names both its sides, an
inversion is named and drawn, inversion carriers stack together, and the header
of a lane inside a long deletion says so instead of the lane drawing blank.

## Success criteria

- Each item below has a unit test that fails with the fix reverted (sabotage).
- The lane chips read as follows on the hosted `hprc_multiway` PIF track and
  the gfa-to-tabix walk track:

  | locus | window | lane | chip names |
  | --- | --- | --- | --- |
  | MAPT | chr17:45.4-46.8 Mb | H2 (HG01123#1) | an inversion; no netted "35 kb" |
  | 8p23.1 | chr8:7.0-12.5 Mb | the 7 carriers | an inversion |
  | CFHR3-CFHR1 | chr1:196.7-196.9 Mb | 4 carriers | "85 kb deletion", as today |
  | GSTT1 | chr22:23.95-24.06 Mb | HG00099#1 | as today |

- On walk stacks, the MAPT H2 lane sits at an end of the stack.
- The R export and the display stack a graph track in the same order.
- AMY1 and KIV-2 goldens unchanged; MAPT and FLNA goldens move only as items 3
  and 4 intend.
- `pnpm verify` and the touched suites green.

## Items, in landing order

`MW/` = `plugins/linear-comparative-view/src/MultiWaySyntenyDisplay/`.

| # | item | where | status |
| --- | --- | --- | --- |
| 5 | R export stacks lanes as a fresh load does | `multiwayTables.ts:482`, model ordering | done |
| 1 | Chip lists both sides of a one-record replacement; cross-record hole only where pieces abut | `MW/layoutMultiWay.ts:287-310` | open |
| 2 | Lane order reads strand, flip-invariant | `MW/structureOrder.ts` | open |
| 3 | Walk path states an inversion against GRCh38 | graph plugin `WalkTabixSyntenyAdapter.ts:171` | open |
| 4 | Chip names an inversion | `MW/layoutMultiWay.ts`, `MW/laneHeader.ts` | open |
| 7 | Lane inside a deletion longer than the window says so | core `clipFeatureToRegion`, display grouping, lane header | open |
| 6 | Template layers survive a 1-1.6 Mb lane | `MW/laneLayers.ts:145` | open, independent |

Done-when, per item:

- **5**: one pure ordering function, gate included (`lanePairsOnAnchor` and
  `laneFetchKinds.lanePairs`), called by the model and `multiwayTables`; a
  graph-source fixture orders the same both ways.
- **1**: within one record, both gaps at `SPLIT_AT_GAP_BP` or more list both
  ("900 kb insertion, 935 kb deletion"), keyed on both gaps, not the net;
  `LaneOpening` carries the stated deletion beside the net `bp`. Across
  records a hole opens only where `laneGap < SPLIT_AT_GAP_BP`. CFHR3-CFHR1's
  two records abut at lane gap 0 and keep their hole.
- **2**: `laneProfiles` returns forward, reversed and inserted bands; the distance is
  `min(d(a,b), d(a, swapBands(b)))`, likewise against the anchor; a lane
  reversed whole sits with collinear lanes, an in-place inversion carrier at
  an end.
- **3**: keep `referenceAligner`; chain only a walk with
  `min(same, opposite)` singly visited shared bases at `SPLIT_AT_GAP_BP` or
  more; add only chained records on the strand `referenceAligner` did not
  choose; one id per record. We measure its per-window time at MAPT and 8p23.
- **4**: a run is maximal consecutive same-strand pieces of one contig after
  setting aside nested pieces (`forEachLaneGap`'s reach rule); named
  "N kb inverted" when both lane neighbours are the other strand and
  collinear with each other, allowing the overlap each flank states with the
  interior at its seam.
- **7**: the worker emits a deletion op spanning the fetched window as a hole
  feature with `recordId` and stated length; the display splits hole features
  out before grouping, so nothing frames, votes, profiles or draws on them;
  the lane header names it without a frame. Two-record deletions and walk
  lanes that skip the window are out of reach.
- **6**: template reads use a finer grid (worst case about 3x the span);
  `bc85b6305b`'s span-bound clause stays, since it stops a pan blink.

## Waiting on a call

**Piecewise lane frame**: `RowFrame.turns`, the runs opposing the frame's
direction, mirrored inside `openedBp`, so an inversion draws straight in its
lane. The pivot sits just outside a turn; overlapping seams cut at their
midpoint, and the X goes. Same idea as
[straighten-an-inversion-by-reversing-its-span](../ideas/waiting-on-a-call/straighten-an-inversion-by-reversing-its-span.md),
deferred 2026-09-24 for LinearSyntenyView rows.
