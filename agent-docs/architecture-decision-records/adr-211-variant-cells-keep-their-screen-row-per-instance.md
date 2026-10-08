---
status: Rejected
summary: "The multi-sample variant display keeps the screen row in every cell instance, re-placed by `placeVariantRows` and re-uploaded whole on a sort, regroup or clustering run, rather than reading rows through render-core's `rowTable` as the multi-row display and the insertion mark do. Measured on the 1000 Genomes matrix at 1,000 records: a reorder costs 25 ms at 2,504 sample rows and 75 ms at 5,008 haplotype rows, 115 ms with reference cells drawn at genomic positions, against under 0.3 ms through the table — once per gesture, behind a clustering run that takes seconds, so nobody would notice the port. Rejected with it: a per-record table for the x axis, whose gain is per fetch and which waits on a second sampler the HAL does not bind"
---

# ADR-211: Variant cells keep their screen row per instance

## Status

Rejected (2026-10-04). Closes the row-table idea
[ADR-210](adr-210-both-variant-layouts-ship-one-cell-payload.md) parked.

## Context

A multi-sample variant cell is (record, row, color, dosage). Both layouts
upload each cell's screen row per instance: `placeVariantRows` rewrites it for
every cell of a block on a sort, regroup or clustering run, and `installUpload`
re-packs and re-uploads the block. The multi-row feature display and the shared
insertion mark read rows through `rowTable` instead
([ADR-165](adr-165-the-row-axis-rides-a-table-the-vertex-stage-samples.md)):
the instance carries a stable row key, the vertex stage samples a two-plane
texture for its drawn slot, and a reorder uploads that table and no instance
bytes. ADR-165 made the move for a reorder measured at 10.7 ms a region.

The variant display is the one row display still placing rows on the main
thread, with `rowRemap`, `rowUnmap` and `cellWorkerRowIndices` keeping the
worker's numbering and the screen's apart. Porting it would delete those and
`Placed<T>`, and converge the three displays on one row mechanism. Whether to
was set against what a reorder costs today.

## The measurement

One block of 1,000 records with every cell present, as the columns layout
fetches it; min of 30 rounds on a laptop at load 4-8, main-thread controls
0.88-1.00x (`plugins/variants/benches/variantReorder.bench.ts`); the upload in
headed Chrome on an Intel UHD 630 through the HAL's own `bufferData`
(`plugins/variants/benches/variantReorderUpload.probe.ts`). The upload arms
read up to 3x apart by their position in the round until the order rotated,
after which the controls' mins agreed within 10%; the mins are the figures.

| Reorder                              | Main thread | Upload        | Through the table |
| ------------------------------------ | ----------- | ------------- | ----------------- |
| columns, 2,504 sample rows           | 15 ms       | 10 ms, 30 MB  | 0.05 ms, 30 KB    |
| columns, 5,008 haplotype rows        | 40 ms       | 30 ms, 60 MB  | 0.08 ms, 50 KB    |
| genomic, reference drawn, 2,504 rows | 23 ms       | 34 ms, 50 MB  | 0.05 ms, 30 KB    |
| genomic, reference drawn, 5,008 rows | 63 ms       | 52 ms, 100 MB | 0.08 ms, 50 KB    |

The upload is synchronous on the main thread at these sizes; a `finish` after
it adds nothing. `referenceDrawingMode: 'skip'`, the genomic default, draws
only the non-reference cells, so the genomic rows overstate that layout's real
block.

## Decision

Keep the per-instance screen row. A reorder costs 25 ms at sample rows and
75-115 ms at haplotype rows, once per gesture and never per frame, at the end
of a genotype sort or a clustering run that itself takes seconds. The port
would not be noticed. The deletion it earns is a tidy-up, not a reason to
touch a display that works, and the asymmetry with the other two row displays
stays.

## Consequences

- `placeVariantRows`, `rowRemap`, `rowUnmap` and `cellWorkerRowIndices` stay,
  and a reader who finds them where the multi-row display has a table should
  read this ADR before porting.
- The two benches stay as the record, so a later sitting on a bigger window or
  a weaker GPU re-opens the question with a number rather than a hunch.

## Rejected

- **Rows through `rowTable`**, the port above: the whole gain is the figures in
  the table, once per gesture.
- **A per-record table for the x axis**, each record's span and glyph in a
  texture per region the `cell` shader indexes by record, dropping the genomic
  instance from 20 to 12 bytes and the `cellGlyphs` deal. ADR-210 declined it
  for the HAL work, a second sampler per pass and a texture per region cached
  by identity, which `pnpm gen:shaders` refuses today. The reorder number
  never bore on it: its gain is per fetch, and it is not worth that work on
  its own.
- **An ordinal x for the matrix**: `matrixCell` already reads a record index.
