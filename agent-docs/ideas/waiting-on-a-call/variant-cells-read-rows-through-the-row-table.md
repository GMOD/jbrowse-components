---
name: variant-cells-read-rows-through-the-row-table
description: "a variant cell's row is a key, not geometry: the pass binds render-core's rowTable, so a sort, regroup or clustering run uploads a rows-sized table instead of re-placing 2.5-5M cells and re-uploading 30-100 MB, and placeVariantRows, rowRemap, rowUnmap and cellWorkerRowIndices go. Measured 2026-10-04 at 25-115 ms a reorder against under 0.3 ms; the call is whether a once-per-gesture hitch plus the deletion earns the port. A record table for the x axis is re-parked behind the HAL's second sampler, since after this a reorder touches no instance bytes"
---

# Variant cells read rows through the row table

Parked 2026-10-04 from
[ADR-210](../../architecture-decision-records/adr-210-both-variant-layouts-ship-one-cell-payload.md)'s
Rejected rows, measured the same day.

A multi-sample variant cell is (record, row, colour, dosage). Both layouts
carry each cell's screen row per instance, rewritten per cell by
`placeVariantRows` on every sort, regroup or clustering run and re-uploaded
whole. The multi-row feature display and the shared insertion mark already
read rows through `rowTable`, a texture the vertex stage samples for a key's
drawn slot and colour override
([ADR-165](../../architecture-decision-records/adr-165-the-row-axis-rides-a-table-the-vertex-stage-samples.md)):
a reorder there uploads a rows-sized table and leaves the instance buffer
alone.

## What a reorder costs today

One block of 1,000 records, every cell present as the columns layout fetches
it, min of 30 rounds on this box at load 4-8
(`plugins/variants/benches/variantReorder.bench.ts` for the main thread,
`plugins/variants/benches/variantReorderUpload.probe.ts` for the upload, headed
Chrome on the Intel UHD 630). The place arm is `placeVariantRows`, the painted
spread and the pack; the upload arm is the HAL's `bufferData` of the packed
buffer. The main-thread controls read 0.84 and 1.00; the upload probe's arms
read up to 3x apart by position in the round until the order rotated, after
which the controls' mins agreed within 10%, and the medians still swing with
position, so the mins are the figures.

| Reorder                                   | Main thread | Upload          | Through the table     |
| ----------------------------------------- | ----------- | --------------- | --------------------- |
| columns, 2,504 sample rows                | 15-16 ms    | 10 ms, 30 MB    | 0.05 ms, 30 KB        |
| columns, 5,008 haplotype rows             | 40-43 ms    | 30-34 ms, 60 MB | 0.08 ms, 50 KB        |
| genomic, reference drawn, 2,504 rows      | 23-24 ms    | 34 ms, 50 MB    | 0.05 ms, 30 KB        |
| genomic, reference drawn, 5,008 rows      | 63-67 ms    | 52 ms, 100 MB   | 0.08 ms, 50 KB        |

So 25 ms a gesture at sample rows in the columns layout, 75 ms at haplotype
rows, 115 ms at haplotype rows with reference cells drawn at genomic
positions, which is not the default: `referenceDrawingMode: 'skip'` draws only
the non-reference cells there, so the genomic layout's real block is far
smaller. The upload is synchronous on the main thread for these sizes, a
`finish` after it adding nothing.

## The call

The gate the measurement was set against, tens of milliseconds and the dealt
arrays stand, hundreds and both tables go in, splits down the middle: a
reorder is tens at sample rows and about a hundred at haplotype rows, once per
gesture, never per frame. The performance case alone is a hitch on a genotype
sort or a clustering run that ADR-165 removed from the other two row displays
at 10 ms a region. The case for doing it is what it deletes: `placeVariantRows`
and `Placed<T>`, `rowRemap` and `rowUnmap`, `cellWorkerRowIndices`, and the
third row mechanism in the tree.

The port: `cellRowIndices` stays the worker's numbering, and the pass binds the
display's `rowTable` as its one texture, `buildRowTable(slot, color)` from the
row arrangement as multi-row's `rowTable` getter builds it. A reorder changes
the table's identity and nothing else. The lookup `findCellIndex` makes is
already in the worker's numbering; both shaders take the `row` lane the
insertion mark already takes, and the painter, the ink, the SVG export and the
hit test read the slot through `rowSlot`. Ten files read the placed row today.

## Not the record table

ADR-210 also declined a per-record table for the x axis, each record's span
and glyph in a texture per region the `cell` shader indexes by record, so the
genomic instance drops from 20 to 12 bytes and `cellGlyphs` goes. The reorder
number does not decide it: once the rows ride the table a reorder touches no
instance bytes, and the record table's gain is per fetch, 40% of the genomic
instance bytes at `referenceDrawingMode: 'draw'` and the dealing loop. It
waits on render-core binding a second sampler per pass and caching a texture
per region by identity, which `pnpm gen:shaders` refuses today, and is not
worth that work on its own.

Not the ordinal x: the matrix keeps `matrixCell`, which already reads a record
index, and takes the row table alone.
