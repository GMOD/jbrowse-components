---
status: Accepted
summary: "The multi-sample variant worker ships one payload shape for both layouts: a `VariantCellData` per block, under each displayed region's index at genomic positions and under 0 for the columns, built by one cell loop. A fact every cell of a record shares - its span, its glyph, its inserted bp, the record itself - ships once per record, in `featureInfo` and the per-feature arrays, and the `cell` mark's per-instance span and glyph are dealt from them on the main thread (`cellGlyphs`), off the payload alone. The RPC takes the display's `layout`, not a wire `mode`, and columns send `referenceDrawingMode: 'draw'`. Rejected: shipping the span and glyph per cell for both layouts, an ordinal x so the matrix draws through the `cell` mark, and a per-record table the shader reads through a texture, which the HAL's one RGBA8 texture per pass does not yet carry"
---

# ADR-210: Both variant layouts ship one cell payload

## Status

Accepted (2026-10-04). Closes the variant wire shapes call in the
[row-displays-on-shared-kernels](../handoffs/row-displays-on-shared-kernels.md)
handoff.

## Context

The multi-sample variant display draws genotype cells in two layouts: at
genomic positions, one block per displayed region through the `cell` mark over
`variant.slang`, and as equal-width columns, one block for the window through
`matrixCell` over `variantMatrix.slang`. Until this ADR the worker shipped a
different payload for each. `mode: 'regular'` carried `perRegionCellData`,
each region's cells with a span and a glyph per cell and its records keyed by
id in `featureGenotypeMap` beside a `featureIdList`; `mode: 'matrix'` carried
one flat set of cells with float column indices and positional `featureData`.
Two cell loops built them, each with its own two-ended bucket writer, and a
dozen getters on the main thread forked on `mode`: colours, placement, the
upload map, the painted domain, the lane's records and the anchored sort each
had a regular arm and a matrix arm. `matrixRegions` already presented the
matrix to its backend as region 0.

## Decision

- **One payload shape.** `CellDataResult` is the fetch's flags plus
  `perRegionCellData: Record<number, VariantCellData>`: one entry per block the
  layout draws, under each displayed region's index at genomic positions and
  under 0 for the columns. A block with no records has no entry.
- **One cell loop.** `computeVariantCells` builds every payload. The RPC's
  `layout: 'genomic' | 'columns'` decides only how the records are grouped
  into blocks, per displayed region in file order or all of them once in
  screen order. Columns send `referenceDrawingMode: 'draw'`, since they always
  draw reference cells; the worker has no layout rule of its own.
- **A per-record fact ships once per record.** `featureInfo` holds the
  records in the order the cells index them, each with its `featureId`;
  `featurePositions`, `featureInsertedBp`, `featureColorValues` and the
  spatial index sit beside it. The per-cell arrays are a cell's own facts:
  row, colour, dosage, record index. The `cell` mark's per-instance span and
  glyph are dealt from the records on the main thread (`cellGlyphs`,
  `regionCellGlyphs`), off the payload alone, so neither a reorder nor a
  recolour redoes them.
- **The main thread reads one map.** `placedRegionRows` places,
  `regionCellColors` paints, `paintedRegionRows` joins them and is what the
  columns upload; `perRegionCellMap` adds the glyph attributes and the
  insertion channels for the genomic marks. `matrixCell` reads a `uint`
  column index, the same `cellFeatureIndices` every other consumer reads.

## Consequences

- The genomic payload drops 9 bytes a cell on the wire and in the worker, the
  span and glyph it repeated per cell. The main thread's peak is unchanged:
  the dealt arrays replace the shipped ones.
- `computeVariantMatrixCells` and its tests go; one loop's tests cover both
  layouts. Tests build payloads through `shared/cellDataFixtures.ts`.
- A layout switch drops the held payload at once (`SettingsInvalidate`), so
  no consumer needs the payload to say which layout fetched it.

## Rejected

- **Ship the span and glyph per cell for both layouts.** One shape at the cost
  of 9 bytes a cell the columns never read, 22 MB on a 2,504-sample window of
  1,000 variants, against the memory the worker was tuned for.
- **An ordinal x, so the matrix draws through the `cell` mark** with column
  spans. The matrix's sub-pixel column blending is its own, and the
  row-displays handoff declines the ordinal x too.
- **A per-record table the `cell` shader reads through a texture**, which
  would drop the per-cell span and glyph from the upload as well. Render-core's
  `rowTable` shows the shape, but a pass binds one RGBA8 texture and re-uploads
  it when its identity moves, so a table per region would re-upload on every
  block of every frame. The dealt arrays stand until the HAL binds a texture
  per region.
