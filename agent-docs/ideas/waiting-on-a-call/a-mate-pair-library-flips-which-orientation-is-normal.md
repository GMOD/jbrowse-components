---
name: a-mate-pair-library-flips-which-orientation-is-normal
description: An RF mate-pair library's true pairs point outward, and the alignments display calls LR normal everywhere, so every true pair paints as abnormal RL and the read cloud keeps all of them as SV evidence. Detecting the library is a few lines; the cost is that LR-is-normal is spelled into the user-facing color levels, the GPU palette, the connection kinds and every label table. The call is whether the data is worth a truthful pairLR category.
---

# A mate-pair library flips which orientation is normal

Long-insert mate-pair libraries (Nextera mate pair and its predecessors, 2–10 kb
inserts) read outward from the circularization junction, so a true pair is
`R1F2`/`R2F1`: RL. The display treats LR as normal throughout:

- `pairCategory.ts`: RL takes `pairRL`, LR takes its insert class.
- `isConcordantFRPair` (`features/arcs/arcColors.ts`) and `isConcordantPairRead`
  (`alignments-core/src/orientation.ts`) only pass LR, so the read cloud drops
  nothing and every true pair stays on screen as an arc.
- The library's paired-end contaminants (short FR inserts) read as normal.

The insert-size side already copes: the band is built from the aligner's proper
pairs, which are RF on such a library, and `widenBandToEventScale` is a ratio.

## Detection is cheap

No setting is needed. The expected orientation is whichever of LR and RL more
primary proper pairs in the fetched sample have, counted beside
`computePairedInsertSizeStats` in `executeRenderAlignmentData.ts`. An FR library
never flips, because an aligner does not mark RL pairs proper on one.

## The cost is the vocabulary

LR-is-normal is not one predicate. It is spelled into:

- **User-facing color levels.** `PAIR_COLOR_LEVELS` in `shared/alignmentsColor.ts`
  gives `RL`, `RR`, `LL` as `scale.domain` values; there is no `LR` level.
- **The GPU palette.** `pairRL` is a slot in `ARC_SLOT_CATEGORY`
  (`shaders/palettes.ts`) and in `read.slang`.
- **Connection kinds.** `isAbnormalConnection` (`alignments-core/readGroupConnections.ts`)
  lists `pairRL`, read by the breakpoint split view too.
- **Labels.** `PAIR_DIRECTION_LABELS`, `CONNECTION_LABELS`, the legend's
  `CATEGORY_LEGEND`, the tooltip's `PAIR_ORIENTATION_NAMES` /
  `ABNORMAL_ORIENTATION_DESCRIPTIONS`, and the group-by chips.

Two designs:

- **Re-encode at the source.** `pairOrientationToNum` takes the detected library
  and swaps LR/RL, so slot 1 means "expected". Every predicate stays as it is,
  and only the labels need the library. Cheap, but a `scale.domain: ['RL']` would
  then name physically-LR pairs on RF data, and the level names would lie.
- **Keep the letters true.** Add a `pairLR` category (a level, a palette slot
  and a `read.slang` change), and pass the expected direction to every
  "is this normal" predicate. Truthful, and medium-sized: about fifteen files plus
  a shader recompile.

The library is per fetched region, so the main-thread surfaces (legend, connection
legend) also need one answer across regions.

## The call

The second design, if mate-pair data has users. The modality is largely retired
(long reads and Hi-C replaced it), so it waits on someone bringing an RF BAM.
IGV's "expected orientation" preference also swaps the LL/RR colors under RF;
keeping the letters true does not need that.
