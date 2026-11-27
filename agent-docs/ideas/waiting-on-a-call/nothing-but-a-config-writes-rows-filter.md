---
name: nothing-but-a-config-writes-rows-filter
description: "`rows.filter` already narrows a row display by sample metadata (\"cases only, in EUR, over 60\"), but only a config or session writes it; the open call is whether a dialog over it earns its place beside the legend's focus."
---

# Nothing but a config writes rows.filter

`focusRows` from a legend swatch covers "show only this population". "Cases
only, in EUR, over 60" is a predicate over `samplesTsv` columns, and
`rows.filter` already holds one: a list of `RowPredicate` entries over row
attributes, all of which a row must pass
([`rowsConfigSchema.ts`](../../../packages/display-kit/src/rowsConfigSchema.ts),
[`rowPredicateConfigSchema.ts`](../../../packages/display-kit/src/rowPredicateConfigSchema.ts)).
It narrows the rows before `rows.kept` does, so a session keeps the criterion
and the chip's "Show all" widens it.

What is missing is a dialog that writes it, on the displays that take `rows`.

## The call

- Whether the dialog is worth building, or legend focus plus a written config
  is enough.
- Where it opens from: the row menu, the legend, or the chip that already
  shows a narrowed row set.
