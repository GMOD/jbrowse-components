---
name: a-mate-pair-library-flips-which-orientation-is-normal
description: An RF mate-pair library's true pairs point outward, but the alignments display calls LR normal everywhere, so every true pair paints as abnormal RL and the read cloud keeps them as SV evidence.
---

# A mate-pair library flips which orientation is normal

Long-insert mate-pair libraries (Nextera mate pair and its predecessors, 2–10 kb
inserts) read outward from the circularization junction, so a true pair is
`R1F2`/`R2F1`: RL. The display treats LR as normal throughout:

- `pairCategory.ts`: RL takes `pairRL`, LR takes its insert class.
- `isConcordantFRPair` (`features/arcs/arcColors.ts`) and `isConcordantPairRead`
  (`alignments-core/src/orientation.ts`) only pass LR, so the read cloud drops
  nothing and every true pair stays on screen as an arc.

What already copes: the insert-size band is built from the aligner's proper
pairs, which are RF on such a library, and `widenBandToEventScale` is a ratio.
The library's paired-end contaminants (~4% on GIAB HG002, TLEN median ~320
against a ~6.3 kb proper median) are improper under bwa and sit under the band,
so `pairCategory` already paints them `shortInsert`.

Not every mate-pair BAM is RF: NxTrim reverse-complements mate-pair reads to FR
by default, and those BAMs draw correctly today as FR long inserts.

## Detection: per library, not per region

IGV detects the orientation per library (read group `LB`), pooled across loads:
over 100 proper pairs, majority of FR / RF / FF, else FR
(`PEStats.computeExpectedOrientation`). There is no preference for it.

Per fetched region is the wrong unit: the RPC runs per displayed region, a
low-coverage window falls back to FR on its own, the legend needs one answer,
and a merged PE+MP BAM would follow whichever library is deeper there. Settle
it per library on the main thread and send it with the RPC; an `auto | fr | rf`
override covers BAMs whose aligner set no useful proper flags.

What the majority counts depends on the aligner:

- **bwa-mem** estimates all four orientations per input batch and calls any
  with ≥10 pairs and ≥5% of the largest proper (`bwamem_pair.c` `MIN_DIR_CNT`,
  `MIN_DIR_RATIO`). An MP library over 5% PE contamination has proper pairs in
  both orientations; the majority flips only past 50%.
- **minimap2 `-x sr`** pairs FR only. On an RF library its proper pairs are the
  contaminants, so detection says FR, which at least agrees with the aligner.

## The cost is the vocabulary

LR-is-normal is not one predicate. Counted from source, a truthful `pairLR`
category touches 25–30 files before tests and generated docs:

- `ReadColorCategory` / `READ_COLOR_CATEGORY` (`colorUtils.ts`), `swatchPaletteKeys`,
  the `AlignmentFill` theme keys (`palette.ts`), `ARC_SLOT_CATEGORY`.
  **Naming trap:** `colorPairLR` is already the neutral grey of a normal pair.
- `PAIR_COLOR_LEVELS` (`alignmentsColor.ts`, `scale.domain` has `RL RR LL`, no
  `LR`), `CATEGORY_LEGEND`, `PAIR_DIRECTION_LABELS` (whose LR label says
  "Normal"), the tooltip tables, `isAbnormalConnection` and its callers,
  `sortLayout`'s rank.
- `isConcordantFRPair`, `pairCategory`, and `isConcordantPairRead` with its
  callers (`readCategoryBits`, `pairing`, arcs `compute`, the breakpoint split
  view's `readChains`), plus the Feature-only helpers (`readCategoryBitsOf`,
  `pairingKey`, `filterChainFeatures`) that would need the expected direction
  before chain selection.

The shader part is the cheap part: one `RC_PAIR_LR` constant and a
`READ_CATEGORY_SLOTS` bump in `read.slang`. A `pairLR` connection kind already
exists in `connectionLabels.ts`.

## Three designs

- **(a) Swap LR/RL at encoding** (`pairOrientationToNum`). IGV does this, and it
  is honest there only because IGV's LR/RL are internal color keys. Here the
  letters leave the code: `scale.domain`, the tooltip
  (`PAIR_ORIENTATION_NAMES`), the group-by chips, and the table/R export
  (`tables.ts`, `pairDirectionOfNum`) would all name physically-LR pairs RL.
- **(b) A truthful `pairLR` category**, as costed above.
- **(c) Truthful per-read codes, library-resolved meaning.** The abnormal slot
  means "faces against the library"; only the level→category table, the labels
  and the concordance predicates read the detected library. No new palette key
  or GPU slot. Breaks only when one view mixes FR and RF libraries. Not yet
  prototyped; try it before (b).

IGV also swaps the LL/RR colors under RF (`AlignmentRenderer.java`'s RF table),
the consistent frame if both reads are reverse-complemented. With truthful
letters it is not needed.

## The call

Keep parked: the Nextera mate-pair kit is discontinued and no current protocol
yields RF or FF proper pairs (Hi-C pipelines usually set no proper flags). The
value is legacy SRA and GIAB data. The test BAM when it is picked up: GIAB HG002
6 kb Nextera mate pair, `bwa mem` defaults, streamable from
`ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/NIST_Stanford_Illumina_6kb_matepair/bams/`
(every proper pair RL across five sampled windows, 2–200 kb).
