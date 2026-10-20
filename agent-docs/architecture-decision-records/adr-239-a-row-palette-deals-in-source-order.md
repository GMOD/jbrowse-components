---
status: Accepted
summary: "A row display's palette deals `rowColor` over the rows in the order their source lists them (`rowColorDealRows` is `expandedRows`): a VCF's samples, a multi-BigWig's subtracks. Values of an attribute the config declares deal first, in its order, loaded or not (`rowColorDeclaredValues`: the multi-row display's `rowGroups` groups). No `rows.domain`, the config's or a reorder's, moves a color, and neither does a region loading later, so the variants and wiggle tables exports, which read the session's `rows.domain`, deal the same colors the screen shows. A config declaring `rows.domain` and leaning on the palette can draw different colors than before."
---

# ADR-239: A row palette deals in source order

## Status

Accepted (2026-10-20), replacing the deal order ADR-160 set.

## Context

ADR-160 dealt the row palette over the base arrangement: `expandedRows`
ordered by the `rows.domain` the track's config.json declares
(`baseRowDomain`), so a reader's reorder recolored nothing on screen.

The tables exports (`variantTables`, `wiggleTables`) take a display config,
which is the session's after a reorder, and dealt over its `rows.domain`.
After a reorder they painted rows colors the screen did not, so an R or CLI
export of a session disagreed with the view it came from. Passing the base
order into the tables API would have fixed it only for callers that knew to
supply it.

## Decision

- **The palette deals over `expandedRows` as the source lists them.**
  `rowColorDealRows` drops the `baseRowDomain` ordering, and both tables
  exports deal over their unordered rows. A row's color depends on its source
  and `rowColor`, never on any order.
- **Declared values deal first.** `rowColorDeclaredValues(field)` lists the
  values of an attribute the config states, dealt in that order whether or not
  a loaded row carries them. The multi-row display answers its `rowGroups`
  groups under `group`. Its rows are found on features and sorted, so dealing
  its groups by first appearance would shift them as regions load; it never
  deals by name, since its rows never share a panel.
- **The key follows.** `rowColorKeyEntries` lists the dealt values in deal
  order, so an attribute key ranks its values by first appearance in the
  source.

## Consequences

- A config declaring `rows.domain` with no `rowColor` pairs can draw a row in
  a different palette color than it did; figures of such configs need a
  reshoot.
- A color a config needs to fix stays a `rowColor` pair, which no order moves.
- A declared group with no loaded row still takes its turn, so the key can
  skip a color: it lists only the values some row carries.
