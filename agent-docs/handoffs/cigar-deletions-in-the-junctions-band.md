---
name: cigar-deletions-in-the-junctions-band
description: "A deletion arc counts only split reads, so a deletion most reads carry as a CIGAR gap draws as weak evidence (COLO829 PTEN: 7 split, 33 gapped). Plan: the junctions band counts SV-size CIGAR deletions too; waits on two measurements."
---

# CIGAR deletions in the junctions band

## The issue

Both arc bands count a deletion's split reads (SA tags) and draw nothing for
reads that carry the same deletion as a gap inside one record (a CIGAR `D`).
The aligner chooses the spelling: minimap2 keeps an event as a gap until the
alignment's z-drop gives up, then splits the read. The picture then depends on
the aligner's settings more than on the evidence.

- **The case that showed it**: COLO829 tumour, ONT R10, call `r_14`, a 12 kb
  deletion through PTEN (chr10:87,940,542-87,952,583,
  `SVLEN=-12041;SVINSLEN=18`), card 366 of the hosted
  [COLO829 review portal](https://jbrowse.org/demos/colo829_review/#card=366).
  33 of 34 spanning reads hold it as gaps and 7 as split reads. The card's
  arc counts the 7, so its best-supported evidence draws thinnest.
- **What a reader asks**: why the 11829 bp gap seems to have an arc and the
  195 bp gap beside it has none. The arc is the split reads', which jump the
  whole event; neither gap draws one. The 195 bp gap is the aligner placing
  the call's 18 inserted bases inside the deletion (11829 + 18 + 195 is about
  12041), so the reads spell one event as two gaps.
- **Where the code already agrees with the fix**: ADR-258's SV channels file a
  deletion-type pair, a split read and a CIGAR deletion under one
  `deletionType` kind. Only the arc bands and jb2export's counts tell the
  spellings apart.

## The plan

Count SV-size CIGAR deletions in the **junctions band**, beside split joins.
Leave the read-connections band as it is.

- **Why that band**: ADR-231's Rejected row defines it as "joins per cut
  point (CIGAR `N` splices and split-read joins)", and read connections as one
  molecule's whole path. It is on by default (`junctions.show`), so the
  default card changes. Its worker already receives deletion gaps and skips
  them (`computeJunctions`, `features/junctions/compute.ts`, which dates from
  when the band drew splices alone). A region's fetch holds every read whose
  gap overlaps it, and `accumulateJunctions` max-merges per region, so a
  deletion spanning windows counts once. The default `junction.reads >= 2`
  floor keeps single-read gaps in repeats off. jb2export's `links` reads the
  read-connections arcs, so it stays a split count.
- **Worker**: `computeJunctions` counts `deletion` gaps of `SV_INDEL_MIN_BP`
  or more, secondaries excluded, under the `splitForward` class code, so a
  gapped and a split deletion on identical coordinates share one
  `junctionKey`. Per record, as split joins count (mates separately).
- **Sum the spellings**: within a region a gap and a split junction on one key
  add; the merge across regions stays a max.
- **Spelling on the junction**: a `junctionGapCounts` array beside
  `junctionCounts`, so the hover and widget read "40 reads: 33 in-read gaps,
  7 split" where they read "Split junction (deletion-type)" now.
- **`junction.source` per junction**: `gap` for reads spelling it inside one
  record (an N splice or an SV-size D), `split` across records; a junction of
  both passes either. Today it is derived from the class (`junctionSource`).
  The RNA-seq example in the alignments `configSchema.ts` moves from
  `source: gap` to `class: splice`, and the CLI validator's copy of the
  vocabulary follows.
- **No splice motif on a deletion junction**: canonical, as a split junction
  reads.
- **Hover read boxes**: a hovered junction records which spellings its
  band counts. The junctions band also boxes reads with a matching `GAP_DELETION`
  (`skipGapReads` in `supportingReads.ts` is the pattern); the read arcs'
  hover keeps walking SA tags.
- **Feet on narrow arcs**: a junction narrower than its two breakend feet
  (`LINK_FOOT_PX` each) drops them, in `placeFeet`
  (`packages/render-core/src/marks/linkMark.ts`), in both bands, so a 60 bp junction
  draws as a bare arc. Amends ADR-286.
- **Tests**: N skips stay splices; the 49/50 bp boundary; secondaries; a gap
  and a split on one key summing; a deletion spanning two regions counting
  once; the source field; the hover boxes. `compute.test.ts`'s "ignores
  deletion gaps" flips.
- **Docs**: an ADR amending ADR-231 (the band's definition), ADR-258 (the band
  above coverage no longer holds exactly the read arcs' junctions) and ADR-286
  (feet, and its "no fan to crowd"); `junctionsConfigSchema.ts` and the
  `junction.source` docs in `baseConfigSchema.ts`; the user guide's
  `alignments_track.md` and `sv_visualization.md`; "a CIGAR deletion draws no
  arc" in
  [svkind-local-indel-against-a-stray-partner](../ideas/waiting-on-a-number/svkind-local-indel-against-a-stray-partner.md)
  becomes "no read arc". The ADR cites
  [route-as-a-launch-input](../ideas/ready/route-as-a-launch-input.md), which
  lists grouping an in-CIGAR deletion as a junction among the steps that
  would make JBrowse a caller, and states the line: identical
  coordinates coalesce, and no event is formed across a gap and a split
  junction or across nearby gaps.

## Next: two measurements, then the build

- **Do r_14's gapped reads agree to the base?** Count the distinct
  (start, end) of the 11829 and 195 bp gaps over the 33 reads. If they scatter
  by a few bases, the one thick arc becomes thin arcs under the floor of 2,
  and the plan needs a rethink before any code.
- **How much does a default long-read view gain?** Deletion junctions
  clearing `junction.reads >= 2` per Mb on HG002 ONT and HiFi, against the
  split junctions drawn there today. The band is on by default, so this is
  the cost every long-read view pays.
- **Data**: the tumour CRAM is
  `https://ont-open-data.s3.amazonaws.com/colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram`.
  `samtools view` against `jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz`
  failed to decode its slices on 2026-11-25; jb2export with
  `~/src/variant-review-portal/examples/colo829_snv/config.json` reads it
  (`--track COLO829_tumor_ont`), so a probe through the worker is the route.

## Left out, for later

- **Read arcs counting gaps**: spiked on branch
  `gapped-reads-join-deletion-arcs` (worktree of the same name) and declined
  in review. A record's gaps are clipped to each fetched region
  (`extractFeatureArrays`), so the deduped copy loses a gap lying wholly in a
  later window. Coalesced arcs keep no per-contributor source, so `links`
  would add the gapped reads to its split count. The read-connections band is off by
  default, so the default card would not change. Delete the branch when the
  build starts.
- **A doubled split join on joined cards**: a two-window card on one
  reference draws its split join twice, as the junctions dome and as the
  read-connections arc jb2export turns on for joined images
  (`applyTrackOpts.ts`). Turning that band on only for cross-reference cards
  removes it; check `links`, which reads that band, first.
- **One window up to about 50 kb**: jb2export draws any deletion over about
  1 kb as two windows (`recordWindows`, `products/jbrowse-img/src/batch.ts`),
  repeating the gap's length label in each. One window reads better at r_14's
  size, and needs an in-window split count, since `links` counts only arcs
  between windows.
