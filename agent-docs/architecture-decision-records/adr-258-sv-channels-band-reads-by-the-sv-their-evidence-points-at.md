---
status: Accepted
summary: "SV channels facets by `svChannel`, `svSignal`'s evidence split into six bands by the kind of SV it points at, every read without evidence, concordant pairs included, in the last: LR pair or deletion-type split, RL pair or duplication-type split, LL or RR pair or inversion split, partner on another chromosome, SV-size insertion, no SV evidence. A split read files by its junctions, paired or not, so short and long reads of one event fill one band; a discordant pair files by its orientation. Replaces the preset's `pairOrientation` facet, under which a long-read track was one 'No orientation' band, and the `svSignal` facet (Group by → SV evidence): `svSignal` stays the filter, the sort and the split view's gate"
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
  | `partnerElsewhere` | Partner on another chromosome or unmapped |
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
- **One ranking** (`SV_CHANNEL_PRECEDENCE`) settles a read whose junctions,
  or a chain whose records, name several: inversion, duplication-type,
  deletion-type, insertion, a partner elsewhere, none. A local event outranks a
  partner elsewhere: on HG00151 ONT, the other order pulled 4 of 83 inversion
  reads out of their band for a stray supplementary on chr4, chr9 or chrX.
- **A read with no split class** files by the rest of its `svSignal`
  evidence: an SV-size deletion to `LR`, insertion to `svInsertion`, a
  discordant pair by its orientation (LL and RR to `inversion`) or, with no
  orientation because its mate is unmapped or on another reference, to
  `partnerElsewhere`. ADR-229 counts an unmapped mate as evidence, and the arcs
  draw it as they draw a mate elsewhere, as a tick.
- **Every read `svSignal` does not count files as `none`**, concordant pairs
  included, so "No SV evidence" holds exactly the reads the Only SV evidence
  filter hides and is the depth every other band is read against. Filing every
  pair by its orientation, the first version, kept concordant pairs in the LR
  band, where "No SV evidence" read as if it held them.
- **Chain mode** files a fragment where its highest-ranked record files; a
  concordant mate files as `none`, last.
- **A band exists only where a fetched read keys to it**, as for every facet.
- **Group by → SV evidence (the `svSignal` facet) is cut.** Its levels repeat
  Split reads and Pair status, and the one thing it did, separating evidence
  from the rest, Filter by → Only SV evidence does with SV channel banding the
  evidence by kind. `svSignal` stays the read category: the filter, the sort
  ("SV evidence first") and the split view's gate (ADR-229). `color: svSignal`
  still colors nothing, and its notice names the filter and the `svChannel`
  facet. The facet was beta-only (v5.0.0-beta.14 on), so a saved `facet:
  svSignal` is not migrated; it reads as a field no read carries and draws one
  section.

## Consequences

- HG00151 ONT at its 1.2 kb inversion draws 5 bands where it drew 1; the
  HG02768 Illumina inverted duplication draws 4 where it drew 5: no deletion
  evidence, so no LR band, its split reads in the inversion band and its
  concordant pairs in "No SV evidence".
- The arcs gate an inter-chromosomal tick by their own support floor
  (`breakpoint.reads`), not by `svSignal`'s mate placement, so a tick can draw
  in "No SV evidence" over a pair whose mate the MQ tag marks unplaced (three
  on HG02768; their MQ tags unchecked).
- The SV channels figure (`sv_channels`) and the user guide's band diagram show
  one inversion band; LL and RR stay apart by arc color, and Group by → Pair
  orientation still gives four bands.
- Not exactly `svSignal` split by type at the edges: a read whose placed pieces
  are not read-adjacent counts as split evidence under `svSignal` and files in
  `none` here, or by its orientation when its pair is discordant; a MAPQ-0
  record of a split read takes its siblings' band.
  A supplementary whose source dropped its SA tag, or a secondary, files by its
  own evidence and may land apart from its siblings.
- `svInsertion` from a split needs the feet on one base exactly; a one- or
  two-base overlap files as duplication-type.
- The keyer runs only under `facet: svChannel`. It reads the start clip off the
  record, since rebuilding the CIGAR string cost 15 to 25 times the rest of the
  classifier, and walks the SA tag in place. It costs what the `svSignal`
  keyer costs, timed in jest on a first pass over freshly fetched records
  (2026-11-02, load ~2.5, median of 8):

  | fixture | records | with SA | `svChannel` | `svSignal` |
  | --- | --- | --- | --- | --- |
  | HG00151 ONT, chr1:197,785,500-197,791,000 | 126 | 87 | 6.6 µs | 6.6 µs |
  | `benches/pacbio_hg002.bam`, chr9 | 2,296 | 13 | 1.0 µs | 0.8 µs |

  A long read's category bits are computed twice, in the keyer and in the
  extract, as under `svSignal`; at about 1 µs a record, memoizing them on the
  record would save a couple of milliseconds a fetch.

## Rejected alternatives

- **Relabelling the LR band to say it holds concordant pairs**: its coverage
  would stay mostly concordant depth, a deletion's pairs showing only as arcs,
  and the band would never be empty, so "a band that stays empty under a call
  is a call with no read evidence" would not hold.
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
