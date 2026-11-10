---
name: row-display-followups
description: Unbuilt row-display follow-ups (multi-row features, multi-wiggle, MAF, multi-sample variants), among them MAF row separators, a dialog that writes `rows.filter` and row-model loose ends, each with its cost and the parts that already exist.
---

# Row display follow-ups

What a 2026-08-25 pass over the row displays priced and did not build, and what
later reviews left open.

**MAF row separators.** `showRowSeparatorsMenuItem` and `RowSeparatorLines`
(now scroll-aware) are shared, so wiring them into MAF is the same three lines
the variant displays took. Not done because MAF's rows already carry a gap
(`rowProportion` < 1), which is a separator by another name; a track configured
at `rowProportion: 1` is the case that would want it.

**A metadata filter dialog.** `focusRows` from a legend swatch covers "show
only this population"; "cases only, in EUR, over 60" is a predicate over
`samplesTsv` columns. `rows.filter` already holds such a criterion (a list of
`RowPredicate` entries over row attributes, ANDed) and narrows the rows before
`rows.kept` does, so a session keeps the criterion and the chip's "Show all"
widens it. Nothing writes it but a config or a session: what is missing is a
dialog over `rows.filter`.

**A multi-row item the 2026-09-01 review left as a product decision.** A jexl
"Filter by..." on the multi-row painting (LinearBasicDisplay has it on the same
data) is new UI. ADR-238's predicate list would spell it, and a legend hide
kept in config with it; the hide is session state until then.

**Row-model loose ends (2026-09-24).** None reached by a shipped config:

- a phased dialog opened before the first cellData and submitted over
  haplotype rows still writes the sample order;
- `refillArray` in `packages/core/src/configuration/configurationSchema.ts`
  works around the fork's quadratic array reconcile, which
  `@jbrowse/mobx-state-tree` 6.6.1 made linear; measure a 5,000-name reorder
  through plain assignment and drop the refill if it holds.
