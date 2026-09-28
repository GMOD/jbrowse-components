---
status: Accepted
summary: "The MAF display stays its own display type, and shares the grammar's concepts and kernels wherever the two compute the same thing. What it draws past the cells and the identity - the codon view, the summary tier, source-chromosome colour, the conservation band, the insertion and inversion glyphs, its hit tests and menus - is MAF's own and stays in it; its layers are already render-core marks and its config already speaks the mark vocabulary. Where the MAF display and the mark pipeline compute one statistic they converge on one implementation, the faster one: one parser per format (getFeatures rebuilt over readBlocks), one packed arena (MafWirePacker, shared since ADR-193), and one identity walk. The mark display keeps drawing MAF for a declared plot, and the capabilities it lacks against the MAF display are built when some track declares a need for them, not to replace it"
---

# ADR-199: The MAF display stays its own, and shares the grammar's kernels

## Status

Accepted (2026-09-28), Colin's call after
[ADR-190](adr-190-the-maf-display-stays-off-the-feature-steps.md) to
[ADR-198](adr-198-a-constant-colour-rides-as-a-scalar.md) brought the mark
display's MAF span to
1.06-1.26x<!--m:typed-sources-maf-display.typedVsMaf.range--> the MAF
display's time: the MAF track has enough of its own that a display type of its
own serves it, and aligning it with the grammar's concepts wherever they fit
is still the aim.

## Context

The MAF display owns no shader: `mafMarks.ts` declares render-core `span`,
`bar` and coverage passes, and its config speaks the mark vocabulary
(`color: mismatch | base | identity | chromosome | codon`, `rows`, the tree
sidebar). What is its own is about 13,700 lines of display, renderer and RPC:
the codon view and its frames join, the zoom-out summary tier, the
source-chromosome colour, the conservation band, the insertion and inversion
glyphs, per-base letters, seven Canvas2D overlays, its hit tests, its menus
(FASTA export, jumping to a species' genome, comparing against the reference,
clustering) and its row and band geometry. The mark display draws the cells
and the identity from general steps in the worker (ADR-186, ADR-187,
ADR-197), and lacks the rest.

## Decision

- **The MAF display stays the MafTrack's display type**, and what it draws past
  the cells and the identity stays in it.
- **Where the two compute the same thing, they share one implementation**, the
  faster of the two, rather than each keeping its own:
  - **One parser per format.** `readBlocks` (ADR-195) is the parse, and
    `getFeatures` is rebuilt over it with a sink that assembles `MafFeature`s
    from the ranges it is handed; the FASTA export and the feature details read
    those. Clustering by identity counts through a sink of its own. Both
    landed:
    [ADR-195](adr-195-a-maf-adapter-parses-its-blocks-into-the-packer.md)'s
    consequences measure them.
  - **One packed arena**, `MafWirePacker`, which both paths fill since ADR-193.
  - **One identity walk.** The MAF display's `buildIdentityRuns` counts matches
    in one walk and the mark pipeline makes runs and then bins them, at
    1.70-2.57x<!--m:interval-bin-maf-identity.fusedVsMaf.range--> its time; the
    declared identity takes the one-walk kernel behind its `cells`, `bin` and
    `aggregate` steps, as ADR-197's fusion took the bin and the aggregate.
    Landed as [ADR-201](adr-201-a-cells-step-bins-as-it-walks.md), at
    0.97-1.58x<!--m:cells-walk-maf-identity.walkVsMaf.range--> the MAF
    display's time.
- **The mark display keeps drawing MAF** for a declared plot (`marks_maf_cells`,
  `marks_maf_identity`). What it lacks against the MAF display — a band stack,
  a coarse tier of per-row records, height-gated per-base text, the insertion
  and inversion glyphs, a second-adapter join, cross-region derived fields —
  is built when a track declares a need for it, not to retire the MAF display.
- **Speed work on either path is welcome**, and lands in the shared kernel
  where one exists.

## Consequences

- A MAF capability is built once where it is a statistic both paths compute,
  and in the MAF display where it is a MAF picture.
- The MAF display's grammar is the mark display's where the concepts match:
  its colour modes, its rows and its layers already are, and a new MAF setting
  takes the mark vocabulary's spelling where one exists.
