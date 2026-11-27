---
status: Accepted
summary: "The junctions band counts a CIGAR `D` of `SV_INDEL_MIN_BP` or more as its own kind, `junction.class: deletion` with `junction.source: gap`, per exact start and end. It merges nothing by tolerance and draws no feet. Amends ADR-231, ADR-258 and ADR-286"
---

# ADR-288: The junctions band counts a deletion the reads carry as a gap

## Status

Accepted (2026-11-27), Colin's call after three independent reviews. Amends
[ADR-231](adr-231-an-alignments-band-is-one-config-object.md) (what the band
counts, and `junction.source` as a property of the junction),
[ADR-258](adr-258-sv-channels-band-reads-by-the-sv-their-evidence-points-at.md)
(the band above coverage no longer holds exactly the read arcs' junctions) and
[ADR-286](adr-286-a-junction-arc-draws-its-breakend-feet.md) (a gap deletion
draws no feet, and a tandem repeat is a fan).

## Context

- **Both arc bands counted a deletion's split reads only.** A read carrying the
  same deletion as a gap inside one record (a CIGAR `D`) drew no arc. The
  aligner picks the spelling: minimap2 keeps an event as a gap until the
  alignment's z-drop gives up, then splits the read. The picture followed the
  aligner's settings more than the evidence.
- **The case that showed it** is COLO829 tumour ONT at the PTEN deletion
  (chr10:87,940,542-87,952,583, card 366 of the hosted COLO829 review portal).
  32 reads hold an 11,829 bp gap and a 195 bp gap; 6 split reads span
  12,041 bp. The card's arc counted the 6, so its best-supported evidence drew
  thinnest. The 195 bp gap is the aligner placing the call's 18 inserted bases
  inside the deletion, so the reads spell one event as two gaps.
- **ADR-258 already files the two spellings together**: a deletion-type split
  read and a CIGAR deletion share the `deletionType` kind. Only the arc bands and
  jb2export's counts told them apart.
- **The junctions band's worker already received deletion gaps and skipped
  them** (`computeJunctions`, `features/junctions/compute.ts`), from when the
  band drew splices alone.

## Decision

- **What counts.** A CIGAR `D` of `SV_INDEL_MIN_BP` (50 bp) or more, counted per
  record as split joins are (mates separately), secondary alignments excluded.
  One junction per exact (start, end). The default floor `junction.reads >= 2`
  applies, as to every junction. A region's fetch holds every read whose gap
  overlaps it, and the merge across regions stays a max, so a deletion spanning
  two windows counts once.
- **The line: exact coordinates, and nothing formed across them.** Reads
  agreeing to the base share a junction. Nothing merges near-identical gaps, one
  read's neighbouring gaps, or a gap with a split junction, and no floor reads
  the depth. Each arc then says one thing a reader can check against the reads
  under it: this many reads carry exactly this gap. Grouping gaps that disagree
  into one event is deciding what the genome did, which the records keep out of
  JBrowse:
  - [reference/ARC_BAND.md](../reference/ARC_BAND.md): split junctions are
    never copies, and reads agreeing on one to the base are its evidence.
  - [ADR-140](adr-140-sv-analysis-is-not-ours-to-ship.md): a view shows what a
    file says, and neither a view nor a converter decides what a genome did.
  - ADR-258's Consequences: telling a real event from a library chimera among
    the partner ticks is SV calling.
  - [ideas/waiting-on-a-call/one-mark-per-interchromosomal-cluster.md](../ideas/waiting-on-a-call/one-mark-per-interchromosomal-cluster.md):
    the `arcKey` rule refuses to merge distinct junctions on a tolerance, since
    five events inside 2.3 kb are five events.
- **A kind of its own.** The junction reads as `junction.class: deletion` and
  `junction.source: gap`. A splice is `class: splice`, `source: gap`; a split
  junction is its class with `source: split`. Source is a property of the
  junction and is no longer worked out from its class.
  - `junction.source: gap` selects splices and gap deletions.
  - `junction.class: deletion` selects both spellings of a deletion.
  - Both together select gap deletions only.
  - "Only split-read junctions" gives back the picture before this change, and
    "Hide split-read junctions" keeps the new arcs.
- **One field names the kind**, and class, source, colour, end ticks, name and
  legend row derive from it. No reader of a junction is told `splitForward` for
  a junction no split read made. Across the worker boundary the kind rides the
  existing `junctionSplitClass` lane as code `SPLIT_JUNCTION_CLASSES.length + 1`,
  with no new typed array.
- **Kept apart from split junctions.** A gapped and a split deletion on
  identical coordinates are two junctions, each with its own count.
- **Drawn** in the deletion-type colour a deletion-type split junction takes,
  with no end ticks: as for a splice, its orientation is never in doubt. It
  reads no splice motif (canonical to the motif filter) and strand 0, as a split
  junction does.
- **Named** "Deletion (gapped reads)" in the tooltip, the feature widget and the
  legend, and its count reads as reads that carry exactly this gap. The widget
  keeps the count in `score`, as every junction's does. The legend
  keeps one row per colour: "Deletion (gapped reads)" with gap deletions only,
  the split label with split deletions only, "Deletion (gapped and split
  reads)" with both. Where the read arcs already key the colour, their row
  ("Split read (deletion-type)") stays in the arcs section and the junctions
  section names the gap deletions alone. A window with no split read shows no
  "Split" label for this colour.
- **Hovering the arc boxes the reads its count used**: the records holding that
  `GAP_DELETION` at that start and end, secondaries excluded.
- **The junctions table's** `class`, `source` and `shown` agree with the
  filter; `level` is empty for a gap deletion unless something draws from it.
- **The read-connections band is unchanged** and counts split reads only, so
  jb2export's `links`, which reads it, stays a split count.
- The RNA-seq example in the alignments `configSchema.ts` selects splices by
  `junction.class: splice`, since `source: gap` now also passes gap deletions.

## Measurements

Junctions with 2 or more reads that the change adds:

| Data | Windows | New arcs |
| --- | --- | --- |
| HG002 ONT R10, ~55x | twelve 2 Mb | median 3.75 per Mb, range 0.5-8, one window at 99 |
| HG002 HiFi, ~57x | twelve 2 Mb | median 2.25 per Mb, range 0.5-6, one window at 15.5 |
| HG002 Illumina 60x (novoalign) | three 2 Mb | 0; the file holds no gap of 50 bp or more |
| NA12878 nanopore direct RNA | chr12:6-8 Mb | 17, beside 1,564 splice junctions |
| NA12878 nanopore direct RNA | ACTB | 10, beside 330 splice junctions |

A gapped and a split deletion on identical coordinates occurred once in the
48 Mb sampled. The COLO829 PTEN numbers are in the Context; the tumour CRAM
(`ont-open-data`, `colo829_2024.03/wf_somatic_variation/sup/COLO829_tumor.ht.cram`)
is read through jb2export with the variant review portal's `colo829_snv`
config, since `samtools view` against `hg38.prefix.fa.gz` failed to decode its
slices on 2026-11-25.

## Consequences

- **A default long-read view gains a few arcs per Mb.** The short-read file
  measured gains none, holding no gap of 50 bp or more.
- **The cost is the crowded tandem repeat.** HG002 ONT at
  chr17:43,250,000-43,266,000 (the RNU2 repeat): 139 reads are each missing
  about 8,200 bp of one 9 kb stretch, written as about 12 gaps per read; the
  reads place those gaps differently, giving 337 distinct gaps, 101 of them
  shared by two or more reads. One deletion of about 8 kb draws as about a
  hundred arcs, over the coverage dip that does show it as one. That is the
  exact-coordinate line drawn on a repeat, and it is accepted: merging those
  arcs would be forming the event.
- In that window 972 of the 1,292 alignments are secondary; the band excludes
  them, but the pileup and coverage draw them by default
  ([ideas/waiting-on-a-call/the-alignments-display-draws-secondary-alignments-by-default.md](../ideas/waiting-on-a-call/the-alignments-display-draws-secondary-alignments-by-default.md)).
- A config selecting splices by `junction.source: gap` now draws gap deletions
  too, and needs `junction.class: splice`.
- The junction class vocabulary gains `deletion` for a gap, so a plugin or a
  tables reader branching on class sees a value with `source: gap` it did not
  see before.

## Rejected

| Option | Why |
| ------ | --- |
| Summing the two spellings on one key (`junctionGapCounts` beside `junctionCounts`, the plan before the build) | Identical coordinates occurred once in 48 Mb sampled, so the sum would almost never fire, and it needs a split class on a junction no split read made. Two junctions keep each count to one spelling |
| Read arcs counting gaps (spiked on branch `gapped-reads-join-deletion-arcs`) | A record's gaps are clipped to each fetched region (`extractFeatureArrays`), so the deduped copy loses a gap lying wholly in a later window, and coalesced arcs keep no per-contributor source, so jb2export's `links` would add PTEN's 32 gapped reads to its 6-read split count. The read-connections band is off by default, so the default card would not have changed |
| A tolerance merge of near-identical gaps, or of one read's neighbouring gaps | At the chr17 RNU2 repeat it would fold about 12 gaps per read and 337 distinct gaps into one event. That forms an event the reads do not spell, which the exact-coordinate line keeps out (ARC_BAND.md, ADR-140) |
| A default depth-relative floor | It would hide a low-fraction somatic deletion that only a few percent of reads carry, the evidence a tumour card exists to show. The absolute floor of 2 already holds the default gain to a median of 3.75 arcs per Mb on ONT. A fraction-of-depth rule is no caller (the coverage band's allele colours and indicator triangles already floor on a `fraction` of depth), so this is declined as a default, not as calling |
| Modelling the junction as the `splitForward` split class with an `inRead` flag (the spike) | A boolean beside a class: the six things that derive from the kind (class, source, colour, end ticks, name, legend row) would each check the flag, and any reader missing it would call a gap deletion a split junction |
| A narrow-arc rule that drops end ticks by pixel width (`placeFeet` in `packages/render-core/src/marks/linkMark.ts`, the spike) | A gap deletion draws no feet by its kind, so the rule had nothing left to fix here, and it would make a split junction's feet (`LINK_FOOT_PX` each) appear and vanish with the zoom in both bands. render-core is untouched |
