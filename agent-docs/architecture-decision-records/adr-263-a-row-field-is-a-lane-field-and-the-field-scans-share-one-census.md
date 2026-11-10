---
status: Accepted
summary: "The multi-row display's default rows field is the scan's `lane` field, whose values each hold features that never overlap; the field scans share one `censusFields` walk; rows banded by a row attribute have one Group by builder. Amends ADR-249"
---

# ADR-263: A row field is a lane field, and the field scans share one census

## Status

Accepted (2026-11-09), on Colin's "aim for the ideal, not intermediate steps"
after an analysis of `LinearMultiRowFeatureDisplay` and one adversarial review
of the design. Amends
[ADR-249](adr-249-the-multi-row-display-is-the-mark-display-with-a-paintings-default-plot.md):
the scan still decides the plot once, by another rule.

## Context

The multi-row display's default rows field was the first "categorical"
attribute: a text field of at most `MAX_LEGEND_ITEMS` distinct values in the
scan's sample. That is what a color key can name, not what a row is:

- A painting's window holds one segment per sample, so the row field takes a
  value per feature. Past twenty samples it was not categorical, and the plot
  rowed on whatever few-valued column the segments were painted by.
- A window of a gene track holds fewer features than the cap, so every text
  attribute was categorical, a unique id included.

The rule also lived in the subtype (`multiRowPlot`), which re-derived field
statistics the scan had already walked the features for.

Three walks answered "which fields do these features carry": the mark scan's
plot fields, its `attributes` list beside them under a second skip list, and the
feature display's Group by candidates (`summarizeGroupByCandidates`). They
disagreed on a structured field (`INFO` against `INFO.DP`) and on a record
value, which the feature display listed as `[object Object]`.

The variant and multi-row displays each built the Group by submenu that bands
rows by a row attribute. The multi-row copy read the mark display's `facet`,
which is undefined while the facet bands the rows, so it ticked None over
banded rows.

## Decision

- **A row is a lane.** The scan reports `PlotFields.lane`: the text field every
  sampled feature carries, of more than one value, whose features never overlap
  within a value. Of several, the one of fewest values; a `name` or `id` only
  where nothing else is one; then the file's column order. The sample is
  deduped by feature id first, since two scan windows both answer a feature
  spanning them.
- **The subtype holds format recipes and no statistics.** `multiRowPlot` reads
  an adapter's listed sources, then the formats it knows (transcripts carrying
  protein matches row on `name`, domains2genome's BED on `transcript`,
  RepeatMasker on `repClass`), then `fields.lane`, then draws one lane.
- **One census.** `censusFields(features, cap)` in
  `packages/core/src/util/fieldCensus.ts` walks the features once and returns,
  per field, how many carry it, whether its single values are numbers, and its
  distinct values up to the cap. `scanPlotFields` and
  `summarizeGroupByCandidates` each read their own rule off it. A structured
  field lists its members by the dotted path a channel reads, and a record is
  no value, on both displays.
- **The two RPCs stay two.** The mark scan samples at display start, unfiltered;
  the feature display scans the whole view on demand, under its filter and byte
  budget (the `toJSON` cost recorded in `fieldCensus.ts` is why).
- **One Group by builder for rows banded by a row attribute**,
  `groupByRowAttributeMenuItems` in display-kit, ticked by `writtenFacet`. The
  mark display offers it with its other row menus, over `rowAttributeFields`,
  the list `bandsRows` tests; the variant display calls the same.
- **One row per and Color by stay the multi-row subtype's.** They offer scanned
  feature fields, which a plot keeping the features' fields can honor and a
  mark that aggregates cannot. One row per goes while a facet's sections draw
  in the rows' place, and the itemRgb row reads the scan's `bedColored`.

The real scan over real files (2026-11-09): one twenty-kilobase window for the
first two rows, such windows across a chromosome for the others.

| File | Before | Now |
| --- | --- | --- |
| BXD painting, 198 strains | `genotype` | `sample` |
| Pfam domains on RefSeq transcripts, the tutorial's locus | `product` | `name` |
| volvox inheritance painting, headerless | `name` | the sample column, every window |
| SyRI regions, rows that overlap themselves | `query`, every window | `query` in 78 of 80 windows, one lane in 2 |

## Consequences

- The rule is as good as its window. A sample of a few features that never
  overlap makes every text field a lane, and the fewest-valued wins: a GFF3's
  `source` column over two annotation sources. The plot is still written once
  (ADR-249), so the first window opened decides.
- An undeclared track whose row values overlap themselves everywhere draws one
  lane, where it used to row on a few-valued column. A config's `rows.field`
  states it, as the SyRI demo's does.
- The feature display's Attribute dialog lists `INFO.SVTYPE` in place of
  `INFO`.
- A facet splitting the features hides Group by with the other row menus; "Edit
  plot..." clears it.
- The multi-row model's `attributes` getter and the `{ "facet": "group" }`
  example, which meant something only under `rows.groups`, are gone.

## Rejected alternatives

- **Keeping "first few-valued attribute" as a fallback under the lane rule.**
  Two heuristics for one question; it would rescue the two SyRI windows and
  bring back the painting defect wherever no lane is found.
- **Ties to `name`.** A window shorter than a painting's segments gives every
  sample one segment, so a per-segment `name` ties with `sample`, and a row per
  segment is the wrong picture; a row per id on a gene track is the same
  picture with another label.
- **`lanes` in the census.** It needs positions, the id dedupe and uncapped
  counts, which the feature dialog's whole-view walk would pay for and never
  read.
- **All three menus on the mark display, the subtype left as its default plot
  alone.** Every declared mark track would scan at start, the plain mark
  display's menu would grow, and a menu would need the plot form's
  field-survival rules.
- **`colorField`, `solidColor` and `colorByMode` on `ColorWritesMixin`.** The
  feature display's `colorField` is the painted encoding and the multi-row
  display's the written slot, so the ladder is not one concept; two displays
  define it, against eight composing the mixin.
- **One RPC for both scans, or a start-of-display scan on every feature
  track.** See "The two RPCs stay two".
- **Radios with value counts, or the Attribute dialog on the multi-row
  display.** The inline radios read a sample, whose counts would mislead, and
  the dialog exists where no start-of-display scan does.
