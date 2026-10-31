---
name: alignments-defaults
description: "Which alignments settings a new user should get without the menu maze: the chain unit (Link mates and supplementary alignments), the read connections band, and insertSizeAndOrientation as the read color. Colin (2026-10-31): the chain unit has outsized value on WGS and long reads, not on RNA-seq, exome unsure; a geneGlyphMode-style `auto` selector is the shape he floated. Nothing built. Open: chain-mode sort, the mate-overlap tint that swamps exome, the `auto` rule and the ADR it needs, then connections over coverage, then the color default and its RNA-seq fix."
---

# Alignments defaults

Colin's ask: insert-size coloring and read connections "are frequently better in
a substantial way" but take a semi-expert to find. On 2026-10-31 he added that
the chain unit "will have outsized positive impact", that "view as pairs (IMO)
[is] not needed on rna-seq" since "rnaseq already has insane depth, this setting
is better and more ideal for wgs", and of exome "might not even be good to have
it for exome...i dunno". Read connections are "likely significantly less needed
for rna-seq" too.

## The shape on the table

`unit: 'auto' | 'read' | 'chain'`, default `auto`, modelled on
`plugins/features/src/LinearBasicDisplay/geneGlyphMode.ts` (an `auto` resolved by
one plain rule, a chip saying what it chose). Today `ALIGNMENTS_UNITS` in
`LinearAlignmentsDisplay/constants.ts` is `['read', 'chain']`. The candidate rule:
`auto` is `chain`, and `read` while the loaded reads hold a spliced read or a
read sort or per-read facet is set. The menu checkbox becomes a radio column
(Auto / Reads / Pairs and split reads).

Unsettled in it:

- **Settings-only getters.** `prefersOffset`, `canSortReads` and `facetForUnit`
  answer before data (`reference/LINEAR_ALIGNMENTS_DISPLAY.md`, "Answerable from
  settings alone"). A data-resolved `auto` must not feed them, or the track label
  jumps when an RNA-seq track loads; answer them as `chain`.
- **It is library detection.** `clearsInterchromFloor`'s comment
  (`features/arcs/arcClustering.ts`) declined tying a rule to the dataset-wide
  `hasPaired`, and ADR-037 declined auto-selecting a preset for dense data.
  `auto` needs its own ADR saying why a narrow visible rule differs.
- **A depth rule was considered and set aside**: "pair while depth is under N"
  flips the layout when a WGS pan crosses a repeat pile.

## What was found

Each verified against the code on 2026-10-31.

- **Chain mode refuses every read sort** (`sortReadsBlockedReason` in
  `LinearAlignmentsDisplay/model.ts`). Layout is main-thread (ADR-053), so
  sorting chains by the member under the clicked base is a
  `computeChainLayout.ts` change; tag sort also needs ADR-188's "chain mode
  sends no sort tag" reopened. No ADR or idea declines it. The `auto` rule above
  sidesteps it by dropping to `read` while a sort is set.
- **The mate-overlap tint swamps short-fragment libraries.** Chain layout tints
  where two mates overlap (`computeChainLayout.ts`, "intra-chain overlap
  intervals"). On the NA12878 exome nearly every pair overlaps, and the pileup
  turns to dark blocks where the per-read view is clean grey. cfDNA would look
  the same. Fainter or no tint likely removes any need to treat exome apart.
- **Read connections drawn over coverage cost no height.** `arcsOverlayCoverage`
  (`sectionLayout.ts`) reserves nothing for `placement: 'up'` with coverage
  shown, and the `down` strip is active only for a lane with arcs. So
  `readConnections: { show: true, placement: 'up', ordinaryPairs: { show: false } }`
  draws no ink on clean data in principle. Unmeasured: whether a clean 30x WGS
  or ONT window draws stray arcs, and the cost of `arcsResult` on every track
  (bench on HG002 300x, `arcUploadPath.bench.ts`).
- **insertSizeAndOrientation has no splice awareness.**
  `computePairedInsertSizeStats` samples every primary proper pair per fetched
  region, and `classifyInsertSize` has no exception. On
  `test_data/volvox/paired_end_stranded_rnaseq.bam` 185 of 485 proper pairs
  (38%) paint long, and the band follows whichever mode holds the median, so the
  same pair is grey in one window and red in an overlapping one. Only 49 of the
  185 carry an N themselves, so a per-read skip filter misses most. Proposed
  rule: a sample holding a spliced read computes no band (orientation,
  interchrom and unmapped-mate colors still paint); the worker already treats a
  skip as the RNA-seq signal (`executeRenderAlignmentData.ts`, the splice-motif
  fetch).
- **Other costs of that color default:** unmapped mates paint `#000000`
  (`colorUnmappedMate`, `packages/core/src/ui/palette.ts`); the strand tint
  under modification calls applies only while no color field is set
  (`bodyColorKind`, `shared/alignmentsColor.ts`); the "Normal" color menu row
  ticks only on an unset field (`menus/colorBy.ts`), so plain grey needs its own
  spelling; `showChevron` (`shaders/slang/read.slang`) hides arrows on
  `RC_PLAIN` but not on normal-insert reads, so zoomed-out reads sprout them.
  No extra fetch or refetch: the stats pass runs on every fetch already.
- **Long reads, unpaired short reads, CRAM, off-screen mates:** the color field
  paints them normal; no false alarms found.

## Measured

Rows from a first-fit pack of every read in the window (duplicates, secondary,
supplementary dropped), read unit vs chain unit, via `@gmod/cram` / `@gmod/bam`
imported from `node_modules/.pnpm` by absolute path. Close to the app's layout,
not identical. Captures were jb2export from source (`src/bin.ts`, `unit=read`
vs `unit=chain`).

- **NA12878 30x WGS** (1000G S3 CRAM, 2x150, median TLEN ~435): 52 to 67 rows
  at chr17:43,092,000-43,095,000, 61 to 88 at chr1:155,000,000-155,010,000.
  About TLEN over twice the read length. Pairs read cleanly.
- **NA12878 exome** (`jbrowse.org/genomes/GRCh38/alignments/NA12878/...exome.cram`,
  2x76, TLEN ~160): 942 to 1016 and 531 to 518. Rows flat; the tint is the cost.
- **Paired RNA-seq** (hg19 RSeQC 2x51, `Pairend_StrandSpecific_51mer_Human_hg19.bam`):
  2074 to 2050 at ACTB, 2461 to 3030 at chr9:136,214,000-136,229,000. Not
  captured. The `metex14` RNA BAMs are single-end and cannot test pairing.
- **HG00151 ONT inversion** (`jbrowse.org/demos/ont/...chr1_inversion.bam`): 65 to
  49 rows; each molecule's inverted segment shares a row with its flanks. The
  clearest win.

## Declined in review

Named view presets (Default / SV / RNA-seq / Long-read) at the top of the menu:
`svChannelsPreset.ts` already cannot restore what it displaced, N presets
multiply that, and switching them automatically is ADR-037's case.

## Next

- Decide the overlap tint (drop or faint), recapture the exome pair.
- Chain-mode sort, or confirm the `auto` rule's drop-to-`read` on sort is enough.
- Write the `auto` unit ADR and build it; capture a paired RNA-seq locus to
  confirm `read` resolves and nothing jumps.
- Read connections over coverage by default: capture clean WGS, RNA-seq and ONT
  windows, bench `arcsResult`, then decide. Menu cleanup either way: one radio
  column (None / Arcs / Read cloud / Arcs by pair orientation), the "Ordinary
  pairs" toggle gone once unset means hidden.
- insertSizeAndOrientation default last, with the spliced-sample rule, a softer
  unmapped-mate color, the strand tint and the "Normal" row fixed.
