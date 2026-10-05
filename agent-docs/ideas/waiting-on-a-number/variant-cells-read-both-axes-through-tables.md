---
name: variant-cells-read-both-axes-through-tables
description: "a variant cell's row and record are keys, not geometry: the rows through render-core's rowTable, so a sort, regroup or clustering run uploads a rows-sized table instead of re-placing and re-uploading every cell, then the records through a second table the HAL does not yet bind, so the cell shader stops carrying a span and a glyph per instance. The number that decides it is what a reorder costs today on the 1000 Genomes matrix"
---

# Variant cells read both axes through tables

Parked 2026-10-04 from
[ADR-210](../../architecture-decision-records/adr-210-both-variant-layouts-ship-one-cell-payload.md)'s
Rejected rows, where the record table was declined for the HAL work it needs.

A multi-sample variant cell is (record, row, colour, dosage). Today the genomic
payload carries the record's span and glyph per instance, dealt from the
records on the main thread (`cellGlyphs`), and both layouts carry each cell's
screen row, rewritten per cell by `placeVariantRows` on every sort, regroup or
clustering run and re-uploaded whole. The multi-row feature display and the
shared insertion mark already read rows through `rowTable`, a texture the
vertex stage samples for a key's drawn slot and colour override: a reorder
there uploads a rows-sized table and leaves the instance buffer alone.

## The measurement

What a reorder costs on the 1000 Genomes phase 3 matrix at a window of a
thousand variants: 2.5M cells placed again on the main thread, 5M at haplotype
rows, and the instance buffer re-uploaded. Time `placeVariantRows` plus the
`paintedRegionRows` spread, then `installUpload`'s re-upload, in headed Chrome,
against a `buildRowTable` upload of 2,504 or 5,008 keys. Tens of milliseconds
and the dealt arrays stand; hundreds, and the two steps below go in order.

## Step one: rows through `rowTable`, which the HAL binds today

`cellRowIndices` stays the worker's numbering, and the pass binds the display's
`rowTable` as its one texture, `buildRowTable(slot, color)` from the row
arrangement as multi-row's `rowTable` getter builds it. A reorder changes the
table's identity and nothing else. `placeVariantRows`, `rowRemap`, `rowUnmap`
and `cellWorkerRowIndices` go, since the lookup `findCellIndex` makes is already
in the worker's numbering; both shaders take the `row` lane the insertion mark
already takes, and the painter, the ink and the hit test read the slot through
`rowSlot`.

## Step two: records through a second table, which the HAL does not bind

The per-instance `startEnd` and `shapeType` the `cell` shader reads become a
texture per region of each record's span and glyph, indexed by the instance's
record index, so the genomic instance drops from 20 to 12 bytes and
`cellGlyphs` and `regionCellGlyphs` go. Two things stand in the way, both in
render-core: a pass binds one texture, since `textures[0]` is the only one
either HAL wires, and `bind` re-uploads a texture whenever its identity moves,
so a table per region would re-upload on every block of every frame. The pass
needs a second sampler, and the backend a texture per region cached by identity
the way its instance buffers are.

Not the ordinal x: the matrix keeps `matrixCell`, which already reads a record
index, and would take the row table alone.
