---
name: the-insert-size-band-paints-spliced-rna-seq-pairs-long
description: On paired RNA-seq the insert-size color paints 38% of proper pairs long and flips between overlapping windows, because the sample has no splice exception; dropping pairs that span a seen junction is the candidate, to be measured on volvox first.
---

# The insert-size band paints spliced RNA-seq pairs long

A defect of the opt-in `insertSizeAndOrientation` color today, default or not.
`computePairedInsertSizeStats` samples every primary proper pair per fetched
region and `classifyInsertSize`
(`plugins/alignments/src/shared/insertSizeStats.ts`) has no splice exception,
so on `test_data/volvox/paired_end_stranded_rnaseq.bam` 185 of 485 proper pairs
(38%) paint long and the band follows whichever mode holds the median: one pair
is grey in one window and red in an overlapping one. The band also feeds the
read connections and the hover.

- Only 49 of the 185 carry an N, so a per-read skip filter misses most.
- "A sample holding a spliced read computes no band" is per-region detection,
  the unit
  [a-mate-pair-library-flips-which-orientation-is-normal](../waiting-on-a-call/a-mate-pair-library-flips-which-orientation-is-normal.md)
  rejects, and it still flips between a window with a junction and one without.
- The candidate is per pair: a proper pair whose span contains a junction seen
  in the fetch leaves the sample and paints normal. That depends on which
  junctions the fetch saw, so measure it against the volvox case first.

Making this color the default is a later step and also needs a softer
unmapped-mate color than `#000000` (`colorUnmappedMate`), the strand tint under
modification calls (`bodyColorKind` applies it only with no color field), a
"Normal" row that ticks for a spelled plain grey (`menus/colorBy.ts`), and
`showChevron` (`read.slang`) hiding arrows on normal-insert reads as it does on
`RC_PLAIN`.
