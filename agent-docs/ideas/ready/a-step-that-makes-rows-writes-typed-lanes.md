---
name: a-step-that-makes-rows-writes-typed-lanes
description: The mark display's steps that make rows (flatten, cells, bin, aggregate) answer typed lanes instead of one Feature each, and a span under rows hovers by row and position instead of through a hit index. A bench-only spike ran the MAF cells declaration at about the MAF display's own speed (0.6 s against its 0.7 s at 470 species, where the Feature steps take 8 s) and its identity plot exact, where the Feature steps answer the wrong one. Colin said to build it on 2026-09-28, in the four stages below, each landing at the replaced path's speed or better on large data.
---

# A step that makes rows writes typed lanes

Written 2026-09-28 from the spike behind
[ADR-190](../../architecture-decision-records/adr-190-the-maf-display-stays-off-the-feature-steps.md),
whose tables hold the numbers.

## The idea

The mark display's worker runs a declaration as steps over `Feature` objects
(`runTransforms` in `packages/core/src/util/featureTransforms.ts`), and a step
that makes rows makes one object per row. The steps' rules are not what costs:
ADR-114, ADR-118, ADR-152 and ADR-190 each priced a port onto the grammar and
each found the object per row. The spike
(`packages/core/benches/columnSteps.ts`) keeps the rules and changes what a
step hands on:

- **A step that makes rows answers typed lanes.** `cells` writes each run's
  span, its state as a byte and the text column it starts at.
- **A table can be a view onto another's rows.** `flatten` answers the
  parser's own records and each one's container index, so it copies nothing.
  A field a row lacks (`start`, the block's `seq`) reads through to the
  container, and a run's `species` is its row's.
- **A column is built the first time something reads it.** A span coloured by
  `state` builds no `base`; a text mark over `base` reads it back out of the
  text.
- **A categorical field is a dictionary**, so the facet and the colour resolve
  once per value rather than once per run.
- **The facet orders the rows ahead of the steps it splits**, so each row's
  pieces come out together and in order. A span under `rows` then answers a
  hover from where each row starts plus a binary search, and ships no hit
  index. Over lanes, the hit index was the largest cost left, larger than the
  MAF display's whole path, and a display holds it besides: four doubles a
  piece in `hitIndexOf`'s Flatbush.

## How it squares with rule 1

[GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md) §"Four rules"
refuses a copy between the parser and the instance buffer that the drawing
gives no reason for, and on that rule a feature column table for BAM, VCF and
GFF was withdrawn on 2026-09-23
([evaluate-jexl-channels-a-column-at-a-time](../waiting-on-a-call/evaluate-jexl-channels-a-column-at-a-time.md)).
This is not that table. The parser's objects stay the data and are read
through views; the only lanes are the rows a step makes, which it makes today
as objects, so the change removes a representation rather than adding one.

## What the spike does not settle

- **The identity's second pass.** The lane identity makes runs and then bins
  them, where `buildIdentityRuns` counts matches straight off the bytes in one
  walk. At 470 species that is
  859.9ms<!--m:maf-on-marks-identity.470-species-200-blocks-of-250-columns.columnsIdentityMs-->
  against the MAF display's
  430.1ms<!--m:maf-on-marks-identity.470-species-200-blocks-of-250-columns.mafIdentityMs-->,
  the one remainder the spike leaves at that scale. A `cells` that bins as it
  walks, where a `bin` follows it, is the obvious fusion.
- **Text as bytes.** The kernel reads `seq` as a JS string where the MAF
  worker's packer walks one byte arena. Copying each row into bytes first (the
  bench's `columns-rows-bytes` arm) helps wide blocks and costs narrow ones; a
  MAF adapter answering its records over the packer's arena would drop the
  copy.
- **`featureIndex`** is still filled as the identity permutation: ADR-152's
  first condition.
- **The hover's feature.** `CoreGetEncodedFeature` answers a feature from the
  layer's list; over a table that is ADR-152's row cursor, which the spike
  does not build here.
- **`jexl:` channels and `filter`/`formula` steps** over a table run through a
  row cursor, which ADR-152 measured and this spike does not exercise.
- **`bin` cutting an interval at its edges**, which the exact identity needs,
  changes what a count per bin answers for a feature wider than a bin. That is
  [maf-onto-marks](../../handoffs/maf-onto-marks.md)' open call, and over
  lanes the cut is arithmetic rather than an object per piece.

## The plan

Colin said to build it on 2026-09-28. Core's step runner and encoder move to
tables in stages, each landing at the replaced path's speed or better on the
largest data it serves:

1. A span under `rows` hovers by row and position, and its layer ships no hit
   index. The facet already emits each section's pieces together; the lookup
   needs each row's pieces ordered by end, which `cells` answers as it walks,
   and a layer whose pieces overlap in a row (a BED under `rows`) needs them
   sorted and a running maximum of their ends. It helps the Feature path too.
2. `flatten`, `cells` and the facet over tables, with the MAF adapter's
   records as the first source.
3. `bin`, `aggregate`, `coverage` and `pileup` as kernels, which ADR-152
   measured at 0.20x<!--m:column-kernels.transforms-bin-count-columns.vsBase-->
   and 1.72x<!--m:column-kernels.transforms-coverage-columns.vsBase--> the bare
   encode for `bin` and `coverage`.
4. The encoder over tables, declining `featureIndex` where it is the identity.
