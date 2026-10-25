---
status: Accepted
summary: "On the mark display, clustering and \"Sort rows by ... here\" compare rows on one mark, `rowCompare`: the first drawing bar, point or line by its `y`, else the first drawing rect by its color. A categorical or identity color compares as its category, one-hot per column with a gap channel, the last covering span winning, and presence past 64 categories; a ramped number compares as each column's mean; a constant compares on presence. A column sort orders a span's categories in blocks, the category most rows show first, then in the categories' own order, so the palette decides nothing. The cover and one-hot helpers live in tree-sidebar's binColumns, which multi-row's matrix now reads too. Second gap of the multi-row-on-marks handoff"
---

# ADR-244: Span rows compare on their color

## Status

Accepted (2026-10-25). The second gap in
the multi-row swap plan, retired by
[ADR-249](adr-249-the-multi-row-display-is-the-mark-display-with-a-paintings-default-plot.md).

## Context

The mark display clustered and sorted rows on the value a bar or point
stands at (`valueMarkIndex`). A rect stands at none, so a painting drawn as
rects in rows had no clustering and no column sort, both of which the
multi-row display offers over its colors.

## Decision

- **`rowCompare` names one mark and what its rows compare on**
  (`rowCompare.ts`): the first drawing mark that reads a value, by `y`, else
  the first drawing rect, by what its `ColorSource` paints from.
- **A rect's color decides the comparison.**
  - Categories or identity: the category, one-hot over the columns a span
    covers, the last covering span winning and a gap channel where none
    covers, as multi-row's matrix does. Past 64 categories a row compares on
    presence.
  - A ramped number: each column's mean, as a bar's `y`.
  - A constant: presence.
- **A one-hot row spends a cell budget.** Its columns widen until the
  columns times the channels fit 13,000, multi-row's budget, so a 16-state
  ChromHMM clusters over about 760 columns.
- **A column sort reads the loaded regions.** Numbers sort highest first;
  a span's categories sort in blocks, the category most rows show at the
  column first and blocks of one size in the categories' own order, read
  back from each painted color through the layer's table so no palette
  reorders them; covered rows sort before bare ones. Where two spans in one row
  cover the column, the one drawn last answers, as it does in the matrix and
  the picture. A region still holding an earlier color declaration answers
  no color, so its rows sort with the valueless ones until it refetches. The
  menu says what it sorts by: the color's field, "color" for identity,
  "presence" or "value".
- **The cover and one-hot helpers are tree-sidebar's** (`coverSpan`,
  `markGaps`, `categoryColumnWidth`, `MAX_CATEGORICAL_VALUES` in
  `binColumns.ts`), and multi-row's `buildMultiRowMatrix` reads them until
  the display retires.

## Consequences

- Two categories the config paints alike, through `unknown` or a repeated
  `range` color, sort as one block, as the picture shows them.
- A row clustered on more than 64 categories says nothing of the fallback to
  presence; multi-row's caption does.

## Rejected alternatives

- **Sorting on the packed color**, as the first cut did: two palettes over
  one locus gave two orders.

- **A "Cluster on" field picker**, multi-row's `clusterField`. The rect's
  color already names the field the picture is about, which is what
  multi-row's `auto` picks.
