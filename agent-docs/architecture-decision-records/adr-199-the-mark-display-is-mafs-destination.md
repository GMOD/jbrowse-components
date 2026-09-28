---
status: Accepted
summary: "The mark display is where MAF drawing converges, and the MAF display stays the shipped display until the mark display can draw what the user guide shows. The MAF display already draws through render-core's marks and its config speaks the mark vocabulary; what is its own is a main-thread data path that builds every MAF feature a second time. Until the switch it takes bug fixes and no speed work on that path, new MAF capabilities land as general mark-display capabilities first, and the cells walk is optimised in the cells step. The switch has four criteria: the seven capabilities the handoff lists, the user guide's figures redrawn by a declared preset, the identity and cells at 1.1x the MAF display or better on every fixture shape, and the menu actions ported. The two MAF parsers are a separate matter: getFeatures stays for the FASTA export, clustering and the feature details whichever display draws, so it is rebuilt over readBlocks rather than retired"
---

# ADR-199: The mark display is MAF's destination

## Status

Accepted (2026-09-28), after
[ADR-190](adr-190-the-maf-display-stays-off-the-feature-steps.md) to
[ADR-198](adr-198-a-constant-colour-rides-as-a-scalar.md) brought the mark
display's MAF span from 7-12x the MAF display's time to
1.06-1.26x<!--m:typed-sources-maf-display.typedVsMaf.range-->. The port list is
[maf-onto-marks](../handoffs/maf-onto-marks.md).

## Context

The MAF display owns no shader: `mafMarks.ts` declares render-core `span`,
`bar` and coverage passes, and its config already speaks the mark vocabulary
(`color: mismatch | base | identity | chromosome | codon`, `rows`, the tree
sidebar). What is its own is about 13,700 lines of display, renderer and RPC:
main-thread packers (`mafChannels.ts`, `identity.ts`, `codons.ts`,
`summarySpans.ts`), seven Canvas2D overlays, its hit tests and its row and band
geometry. The mark display draws the same cells and the same identity from
general steps in the worker (`flatten`, `cells`, an interval `bin` and a
weighted `aggregate`, ADR-186, ADR-187, ADR-197). Two data paths mean every
MAF capability is built twice and every speed-up is taken twice, as ADR-193 and
ADR-195 each were.

## Decision

- **The mark display is the destination.** A MafTrack's default display
  becomes a declared mark preset, and `LinearMafDisplay` goes, once the switch
  criteria below hold.
- **Until then the MAF display stays the shipped display.** It takes bug fixes.
  It takes no speed work on its own data path (`placeMafRegionData`,
  `buildMafChannels`, `buildIdentityRuns`, the main-thread packers).
- **A new MAF capability lands in the mark display first**, as a general
  capability another track can use, rather than in the MAF display's packers.
- **The `cells` walk is optimised in the `cells` step**, the kernel that
  remains, not in `buildMafChannels`.

## The switch

The MafTrack's default moves to the mark preset when all four hold:

1. **The seven capabilities** the handoff ranks, each built as a mark-display
   capability: a band stack above the rows for coverage and conservation; a
   coarse tier serving per-row summary records, where the density tier serves
   one row of bins; per-base text gated by row height and coloured against its
   cell; the insertion marker with its count and the inversion hatch; a
   second-adapter join for the codon cells, letters, conservation and CDS
   strip; cross-region derived fields (the source-chromosome rank, the
   inversion consensus strand); SNP and interbase coverage in the band.
2. **Figure parity**: every figure in `website/docs/user_guides/maf_track.md`
   redrawn by the preset and judged against the MAF display's.
3. **Speed**: the cells span and the identity at 1.1x the MAF display's time or
   better on all three `mafOnMarks.bench.ts` shapes. The identity stands at
   1.70-2.57x<!--m:interval-bin-maf-identity.fusedVsMaf.range--> today, which
   is the `cells` walk.
4. **The menu actions**: FASTA export, jumping to a species' genome, comparing
   a species against the reference, the subtree selection and clustering by
   identity. These call RPCs over the adapter, not the display's state, so the
   port is their menu wiring.

v5 has not shipped, so the switch carries no migration of saved sessions.

## The two parsers

ADR-195 left MAF-tabix and bigMaf with two parsers each: `readBlocks`, which
hands a sink each sequence as a range of its line, and `getFeatures`' own
parse into `MafFeature`s. Retiring the MAF display does not retire the second:
the FASTA export (`MafGetSequences`), clustering by identity
(`buildIdentityMatrix`), the feature details and any plugin read
`MafFeature`s. So `getFeatures` is rebuilt over `readBlocks`, with a sink that
assembles `MafFeature`s from the ranges it is handed, leaving one parser per
format. That does not wait on the switch. Clustering by identity walks each
sequence byte by byte and is better served by a sink of its own than by a
string per species.

## Consequences

- The MAF display's own speed stays where ADR-195 left it; a regression in it
  is a bug, and an improvement goes into the pipeline instead.
- The port list is the work, and it is general: each item is a capability of
  the mark display that any track may declare, not a MAF mode.
