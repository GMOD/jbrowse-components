---
name: the-mark-pipeline-runs-over-tables
description: The mark display's worker pipeline over tables rather than one Feature per piece - a table with provenance, a column resolved once per step by its kind, every step one kernel, the facet a partition split as early as the steps allow, the encoder reading lanes, and a row becoming a Feature only for a jexl expression or the hover. The pipeline landed as ADR-191 and the row lookup that spares a span its hit index as ADR-192, both 2026-09-28; what is left is typed sources (the BigWig adapter's arrays, the MAF worker's arena) and declining featureIndex where it is the identity.
---

# The mark pipeline runs over tables

Written 2026-09-28 from the spike behind
[ADR-190](../../architecture-decision-records/adr-190-the-maf-display-stays-off-the-feature-steps.md),
whose tables hold the numbers, and Colin's call the same day to build the ideal
system rather than a shim around the Feature pipeline.

## What changes for a user

Nothing they write. A declaration draws what it draws today, and the hover
answers the same fields. What changes is the time: a declared plot over large
data stops paying one JavaScript object per piece at every step, which is the
difference between seconds and tenths of a second in the spike, and the
difference ADR-114, ADR-118 and ADR-152 each measured and refused a port over.

## The model

**A table** is what one step hands the next: a row count, a column per field,
and a way to see one row as a `Feature`.

```ts
interface FeatureTable {
  readonly length: number
  column(field: string): Column
  row(i: number): Feature
}
```

**A column is resolved once per step, by kind**, so a kernel picks its loop
before the loop and runs it monomorphic (rule 3):

- `number`: a typed lane a step wrote (`start`, `end`, a bin's edges, an
  aggregate's mean), with an optional row index when it belongs to a parent.
- `category`: codes into a list of labels, where a step knows its values are
  few (`cells`' `state`, `flatten`'s key). A facet and a categorical colour
  resolve once per label.
- `value`: read per row off the parser's own objects, which is what a feature
  adapter's fields are until something needs them typed.
- `none`: no row carries the field.

**A table can stand on another's rows.** A derived table records, for each of
its rows, the parent row it came from, and a field it does not carry reads
through to the parent's column with the index composed: a species row reads its
block's `start` and `seq`, a run reads its row's `species`. Nothing is copied to
make that work, which is what keeps rule 1: the parser's objects stay the data,
and the only lanes are the rows a step makes, which it makes today as objects.

**A derived row is either the same row or made from one**, and `parent()`
follows which. A `filter`, `formula`, `bin`, `pileup` or `mate` row is its
parent row with fields beside it, so its `parent()` is that row's, as
`DerivedFeature`'s was. A `flatten` entry or a `cells` run is made from its
parent row, so its `parent()` is that row. `cells` reads its reference off the
first made-from ancestor's parent, past any same-row step, and a container
`flatten` kept with nothing to fan out is the container itself.

**A row is a `Feature` only at the edges**: a `jexl:` expression, a
`ChannelReader` a display's worker method hands the encoder, and the hover's
JSON. `row(i)` answers a view over the table (its `get` reads the columns, its
`toJSON` gathers its own fields over its parent's, minus a fanned-out field as
`FlattenedFeature` does today).

## The steps

One implementation each, over tables, and the Feature-list steps go. Each
answers its rows in the order the Feature step answered its features, within
each section: a `pileup` in start order with an unreadable start last, an
`aggregate`'s groups in the order their first members came, a `coverage`'s
runs merged where neighbours hold one depth, a `mate`'s first statement of a
pair. Ids and the hover's JSON follow the classes they replace, `uniqueId`
included, which for a run or a `formula` row is its parent row's.

| step | answers | rows |
| --- | --- | --- |
| `filter` | the parent's rows kept, as an index | the parent's |
| `formula` | the parent with one `value` column added | the parent's |
| `flatten` | one row per entry, over the entry objects and the container | derived |
| `cells` | typed lanes per run, `state` a category | derived |
| `bin` | the parent with two `number` edge lanes | the parent's |
| `aggregate` | typed lanes per group, groupby columns as the members had them | made |
| `coverage` | typed lanes per run of depth | made |
| `pileup` | the parent with a `number` row lane | the parent's |
| `mate` | one row per admitted end, its mate fields as columns | derived |

`DerivedFeature`, `MadeFeature` and `FlattenedFeature` go with them. A made
row's hover carries the fields its step wrote, as `MadeFeature`'s does.

**The facet is a partition, not a split.** Ordering the rows by section is a
counting sort into an index; every facet and layer step then runs once over
the ordered table, a row-local step keeping section order as it goes and
a grouping step (`aggregate`, `coverage`, `pileup`, `mate`'s dedupe) grouping
within each section's range. That is today's rule, "each layer's steps run over
each section alone", met without splitting the rows into arrays and stitching
them back. A section is as tall as the tallest layer packed it, so the stacked
row lane is written once every layer has run. Over a `category` column, which
`flatten`'s key is where every entry is keyed by name, the split files each
label once and each row by its code.

**The split comes as early as the steps allow** (`layerTables`). A shared
step that must see every row (`pileup` packs across sections, `flatten` may
hand an entry its own value of the field) runs before it; the shared steps
after the last such one read a row and answer rows of it in order without
writing the field, so they run after the split and answer the same rows in the
same order. Over `marks_maf_cells` that splits the species rows behind
`flatten`, so `cells` writes each species' runs together and the encoder reads
its lanes with no index. `layerFeatures`, the row-matrix RPC and the marks test
harness all run a request through it.

## The encoder

`encodeFeatures` keeps its signature for a caller holding a feature list
(wiggle, the score example) and becomes a table encode over a source table.
Each channel compiles against its column's kind:

- a `number` column whose lane already is the `uint32` the `x` lane wants, with
  no index and no row skipped, is the lane: `cells` hands `x` and `x2` over
  with no copy;
- a `category` colour, shape or text resolves per label;
- a `value` column reads per row as today;
- a dotted path or `jexl:` channel reads `row(i)` through one moving cursor.

Unplaceable rows are skipped and counted as today, so `featureIndex` still
names a table row. Declining it where it is the identity is ADR-152's first
condition and a later landing.

## The sources

A feature adapter's `getFeaturesArray` becomes a source table whose columns are
`value` reads off its features. An adapter already holding typed arrays answers
a table of lanes instead: the BigWig adapter's `starts`, `ends` and `scores`,
and the MAF worker's arena, over which `flatten` on `alignments` is a view with
no record read at all. Those are later landings; the source table is the only
one the first needs.

## The hover and the hit test

`CoreGetEncodedFeature` runs the request again and answers
`row(featureIndex).toJSON()`. A span answers the pointer by the row it stands
in and ships no hit index
([ADR-192](../../architecture-decision-records/adr-192-a-span-answers-a-hover-by-its-row.md));
a mark that stands at a value, or a link across rows, keeps the Flatbush.

## What it breaks

`runTransforms` and `facetLayers` are plugin ABI (`@jbrowse/core/util/featureTransforms`
is a runtime re-export), and they answer tables where they answered feature
lists; `FacetedLayer` carries `table` where it carried `features`. v5 has not
shipped, and no plugin in this tree or in the store plugins' own checkouts
calls either.

## Landings still to come

The table core, every step, the facet partition and planner, the encoder and
the hover landed as
[ADR-191](../../architecture-decision-records/adr-191-the-mark-pipeline-runs-over-tables.md).
Each landing below clears the same gate: the suites over the pipeline green,
and `tablePipeline.bench.ts` and `mafOnMarks.bench.ts` at the path it replaces
or better on their largest inputs.

The row lookup landed as ADR-192.

1. **Typed sources**: the BigWig and MAF tables, and `featureIndex` declined
   where it is the identity.

## Calls that stay open

- **`bin` cutting an interval at its edges**, which the MAF identity needs,
  changes what a count per bin answers for a feature wider than a bin
  ([maf-onto-marks](../../handoffs/maf-onto-marks.md)). Over lanes the cut is
  arithmetic, and `binSpan` in the row-matrix RPC already weights a span by the
  bases it puts in each column.
- **Columnar `jexl:`**
  ([evaluate-jexl-channels-a-column-at-a-time](../waiting-on-a-call/evaluate-jexl-channels-a-column-at-a-time.md))
  becomes worth building once the data is columns, which this makes it.

## What the spike left open

- **The identity's second pass.** The lane identity makes runs and then bins
  them, where `buildIdentityRuns` counts matches straight off the bytes in one
  walk. At 470 species that is
  859.9ms<!--m:maf-on-marks-identity.470-species-200-blocks-of-250-columns.columnsIdentityMs-->
  against the MAF display's
  430.1ms<!--m:maf-on-marks-identity.470-species-200-blocks-of-250-columns.mafIdentityMs-->.
  A `cells` that bins as it walks, where a `bin` follows it, is the obvious
  fusion.
- **Text as bytes.** The spike's kernel reads `seq` as a JS string where the
  MAF worker's packer walks one byte arena; the MAF source table removes the
  difference.
