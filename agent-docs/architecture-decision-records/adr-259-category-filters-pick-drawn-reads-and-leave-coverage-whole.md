---
status: Accepted
summary: "The alignments `filter`'s flags, `mapq` and tags decide which reads count toward coverage; `name` and the read categories (`spliced`, `svSignal`, `split`, `alone`) only pick which counted reads are drawn, leaving coverage whole"
---

# ADR-259: Category filters pick drawn reads and leave coverage whole

## Status

Accepted (2026-11-04). Colin decided the line on 2026-10-12, in the proposal
this replaces (its Idea 1 landed as ADR-229 and ADR-230 declined its Idea 3).
The SV channels redesign (ADR-258's second 2026-11-04 amendment) needed it
built: its filter hides the reads without evidence and its "No SV evidence"
band must keep their depth.

## Context

- **The category filters thinned coverage.** `selectChains` ran ahead of the
  facet, the extract and the coverage pipeline, so `split: only` drew a band
  of split-read depth and `svSignal: only` left "No SV evidence" with no
  coverage at all. The slot doc said the filter ran before every band.
- **`name` and `spliced` ran in the adapters**, beside the flags and tags, so
  "Filter for this read" left an insert-size sample of one pair (no band), and
  neither applied to synteny blocks, which no adapter filter reaches.

## Decision

| Which reads count (thins coverage) | Which reads are drawn (leaves it whole) |
| --- | --- |
| `flags.*` and `tags.*` (the adapters), `mapq` (the worker, after dedupe) | `name`, `spliced` per record; `svSignal`, `split`, `alone` per chain |

- **One drawn-read rule** (`drawnReadMask`, `filterChainFeatures.ts`) over a
  read source by index. The render hands it what its extract already holds
  for every read (the category bits and the name block), the consensus,
  exports and the tag dialog read the records (`featureSource`), so the
  pileup, consensus, `exportedReads.ts` and `GetGlobalValueForTag` share one
  definition. `svSignal`, `split` and `spliced` read `readCategoryBits`.
- **Chains are judged over every section at once**, after the facet
  partitions the sample, so a strand facet cannot split a chain's verdict.
- **Every counted read is extracted and counted.** Detail arrays, coverage,
  the fade frequencies and the junctions run over the sample; then
  `drawnInstanceArrays` (`shared/drawnReads.ts`) keeps each drawn read's
  instances in order, remapping its read index. A drawn mismatch keeps the
  frequency it had among every read, so it fades by its share of the
  coverage.
- **`sampleEvents`** carries the sample's mismatch, gap and interbase arrays
  while the filter leaves a section's reads out, and is absent otherwise.
  `countedEventsOf` picks it for `getCoverageBin`, `getInterbaseBin`,
  `nonReferenceAt`, `coverageBinAt`'s SNP snap and the tables' allele
  frequencies, so their counts agree with the depth beside them.
- **The reach is stated where the filter is written**: the slot doc, the
  "More filters..." dialog's two headings ("Which reads count", "Which reads
  are drawn") and the user guide. A read category takes `equal: true` or
  `false`, and `filterProblems` says so for any other test, since ADR-229's
  `svSignal: 'only'` compared the string with a boolean and hid every read.
- **Figures that drew a category's own depth** group by it and hide the other
  section: `cancer_sv`'s `derivative_inserts`, `derivative_synteny`,
  `k562_fusion_inspector_reads` and `k562_bcr_abl_split` take
  `facet: { field: 'split', hidden: ['unsplit'] }` beside the filter, in chain
  unit, which keeps every record of a split read in one section.

## Consequences

- A category filter no longer saves the extract or the detail arrays. Timed
  by `benches/drawnReadFilter.bench.ts` (2026-11-04, load ~4, min of 11) on
  `1000x.shortread.bam` chr22_mask:124,000-134,000, 81,417 records, against
  the unfiltered render: "Filter for this read" 1.02x, `split: false` (draws
  every read) 1.15x, `svSignal: true` (draws 36) 1.23x. On
  `200x.longread.bam` every arm is within 1.02x. What remains is grouping the
  reads into chains by name, which the filter paid before too (`groupBy` over
  the same fetch cost 40 ms; the per-section key array and answer sets that
  replaced it cost a third of that).
- `sampleEvents` holds the sample's three instance arrays beside the drawn
  ones while a filter leaves reads out: little extra under `svSignal`, where
  few reads draw, and close to double under a filter that hides few.
- `name` and `spliced` reach synteny blocks for the first time.
- The coverage tooltip says nothing about a filter: its counts now match the
  band, so there is no disagreement to explain.

## Rejected alternatives

- **Every filter leaves coverage whole.** Duplicates and MAPQ-0 reads would
  count, against `samtools depth` and IGV.
- **An unfiltered depth lane beside the filtered one.** A facet already
  draws per-category depth, and a second lane is a second band to explain.
- **Filtering on the main thread** (ship every read, mask at layout, as
  ADR-188 moved chain identity): instant toggles, for a skip path in every
  row-instanced packer.
- **The hidden reads' arrays shipped beside the drawn ones and summed** (the
  proposal's smallest form): `findSignificantInBin` walks one sorted array, so
  two would need merging on every hover.
- **Compacting the extraction before the detail arrays and building twice**:
  the fade frequencies would need a counting set and an evaluated set; one
  build over the sample and one compaction after keeps them aligned.
- **The reach spelled in config** (`filter.sample` / `filter.drawn`, or a
  layer filter on the pileup): each field's reach is fixed, so the split
  would hold one legal value per field, and arcs, consensus and exports read
  the drawn reads too (ADR-232's Rejected row on `filter.sample`).
- **A `dim` filter value or an `opacity` channel**: the SV evidence filter
  with the `svKind` facet separates the evidence instead (ADR-258).
