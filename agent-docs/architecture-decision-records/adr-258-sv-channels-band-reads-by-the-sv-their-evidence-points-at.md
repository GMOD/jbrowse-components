---
status: Accepted
summary: "SV channels facets by `svChannel`, `svSignal`'s evidence split into six bands by the kind of SV it points at: LR pair or deletion-type split, RL pair or duplication-type split, LL or RR pair or inversion split, partner on another chromosome, SV-size insertion, no SV evidence. A split read files by its junctions, paired or not, so short and long reads of one event fill one band; a pair without a split class files by its orientation. Replaces the preset's `pairOrientation` facet, under which a long-read track was one 'No orientation' band"
---

# ADR-258: SV channels band reads by the SV their evidence points at

## Status

Accepted (2026-11-02). Colin asked for the long-read gap to be closed and for
the reviews to settle the open calls; built in
`plugins/alignments/src/shared/svChannel.ts`.

## Context

- **SV channels was a short-read arrangement.** The preset faceted by
  `pairOrientation`, and an unpaired read has none (`hasPairOrientation`), so a
  long-read track opened as one "No orientation" band and only its arcs carried
  the junction class. A short-read pair with its mate on another chromosome
  shared that band with mate-unmapped reads.
- **`svSignal` (ADR-229, ADR-230) already says which reads are evidence**; it
  does not say what kind of SV they point at.
- **A supplementary's pair orientation comes from its own strand**, so an
  inverted short-read split filed apart from its own primary under
  `pairOrientation` (`volvox-sv.bam`, `ctgA_1041…`: primary RR, supplementary
  LR).

## Decision

- **`svChannel`, a facet-only read dimension**, six levels:

  | Key | Label |
  | --- | --- |
  | `LR` | LR pair or deletion-type split |
  | `RL` | RL pair or duplication-type split |
  | `inversion` | LL or RR pair, or inversion split |
  | `otherChromosome` | Partner on another chromosome |
  | `svInsertion` | SV-size insertion |
  | `none` | No SV evidence |

  The SV channels preset facets by it and its menu label drops "(pairs by
  orientation)".
- **A split read files by its junctions, paired or not**, classed as its arcs
  color them (`splitJoin`, shared with the worker's split-junction counting in
  `features/sashimi/splitJunctions.ts`), so a read never splits across bands and
  its band agrees with its arc.
- **A junction counts only between two read-adjacent pieces both placed**
  (MAPQ above 0, ADR-229), and never across an unplaced piece.
- **Within one read**: inversion, then duplication-type, deletion-type, a split
  whose feet share a base (`svInsertion`), then a piece on another reference.
  A same-reference junction outranks a piece leaving it: on HG00151 ONT, the
  other order pulled 4 of 83 inversion reads out of their band for a stray
  supplementary on chr4, chr9 or chrX.
- **A read with no split class** files by its pair orientation (LL and RR to
  `inversion`), else by the rest of its `svSignal` evidence: an SV-size
  deletion to `LR`, insertion to `svInsertion`, a placed mate on another
  reference to `otherChromosome`.
- **Chain mode** files a fragment by its most specific member
  (`CHAIN_PRECEDENCE`), so a concordant LR mate never outranks its split
  partner.
- **A band exists only where a fetched read keys to it**, as for every facet.

## Consequences

- HG00151 ONT at its 1.2 kb inversion draws 5 bands where it drew 1; the
  HG02768 Illumina inverted duplication keeps 5, its split reads leaving the LR
  band for the inversion band.
- The SV channels figure (`sv_channels`) and the user guide's band diagram show
  one inversion band; LL and RR stay apart by arc color, and Group by → Pair
  orientation still gives four bands.
- Not exactly `svSignal` split by type at the edges: a read whose placed pieces
  are not read-adjacent counts as split evidence under `svSignal` and files in
  `none` here, and a MAPQ-0 record of a split read takes its siblings' band.
  A supplementary whose source dropped its SA tag, or a secondary, files by its
  own evidence and may land apart from its siblings.
- `svInsertion` from a split needs the feet on one base exactly; a one- or
  two-base overlap files as duplication-type.
- The keyer runs only under `facet: svChannel`. It reads the start clip off the
  record and walks the SA tag in place; a bench on a real long-read fetch is
  outstanding.

## Rejected alternatives

- **Eight bands** (LL, RR and a read-through band apart): LL and RR are the two
  ends of one inversion, and the arcs keep them apart by color.
- **A per-read "several classes" bucket**: the commonest long-read inversion read
  has an LL and an RR junction and would land in it.
- **Pair orientation before the split class**: files an inverted supplementary
  apart from its primary.
- **A piece on another reference first**: pulls local events' reads out of their
  band for a stray supplementary.
- **Drawing every level, or only levels with reads in the visible window**: the
  first spends height on nothing, the second makes bands appear and vanish on
  every pan.
- **A second preset row keeping `pairOrientation`**: nothing reads separate LL
  and RR bands, Group by → Pair orientation remains, and named presets were
  declined (`handoffs/alignments-defaults.md` §"Declined in review"). An
  automatic pick between two facets is ADR-037's case.
