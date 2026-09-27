---
name: row-display-followups
description: What the 2026-08-25 pass over the four row displays (multi-row features, multi-wiggle, MAF, the two multi-sample variant displays) left unbuilt — a fixed row height with a scroll viewport for multi-wiggle, MAF row separators, a metadata filter dialog, two multi-row product calls and the row-model loose ends — with what each one costs and what already exists to build it from.
---

# Row display follow-ups

What a 2026-08-25 pass over the row displays priced and did not build, and what
later reviews left open.

**Multi-wiggle: a fixed row height and a scroll viewport.** The one row display
with no `RowHeightMixin`: it is always fit-to-height, and past ~100 subtracks
`MultiWiggleHint` tells the reader to switch renderings or grow the track.
Everything but the shader exists — `useRowVirtualScroll` (core) and
`VerticalScrollbar` are shared with MAF and the variant displays,
`rowHeightConfigSchemaFields` + `RowHeightMixin` + `rowHeightMenuItem` are the
slot, the getters and the menu. What is missing is a `scrollTop` uniform in
`wiggle.slang` / `wiggleLine.slang` and the Canvas2D twin, a `rowsHeight`
viewport under `plotGeometry`, and the per-row axes (the chrome's, off `valueScales`)
culling to it. Declined in the pass because fit-to-height is what the display
is for at cohort scale (a 1,000-row density matrix is read as a stack), and the
hint's advice is right more often than a scrollbar would be.

**MAF row separators.** `showRowSeparatorsMenuItem` and `RowSeparatorLines`
(now scroll-aware) are shared, so wiring them into MAF is the same three lines
the variant displays took. Not done because MAF's rows already carry a gap
(`rowProportion` < 1), which is a separator by another name; a track configured
at `rowProportion: 1` is the case that would want it.

**A metadata filter dialog.** `focusRows` from a legend swatch covers "show
only this population"; "cases only, in EUR, over 60" is a predicate over
`samplesTsv` columns. The focus, `rows.kept`, is a name set, so a dialog
that evaluates a jexl over each source and writes the matching names is small;
what it lacks is a persistent record of WHY those rows (the filter expression),
which a name set cannot carry — a session would reopen with the rows narrowed
and no way to widen the criterion. That wants a `rowFilter` member beside
`rows.kept`, resolved into the name set on read.

**Two multi-row items the 2026-09-01 review left as product decisions.** A jexl
"Filter by..." on the multi-row painting (LinearBasicDisplay has it on the same
data) and a per-feature "Color by..." menu are new UI.

**Row-model loose ends (2026-09-24).** None reached by a shipped config:

- a phased dialog opened before the first cellData and submitted over
  haplotype rows still writes the sample order;
- a dialog recolour under a multi-row `rowColor: { scale: 'none' }` replaces
  the object and turns the palette back on for every row;
- a density sidecar standing in under `rows` draws in the first row only, and
  `valueMarkIndex` picks the hidden mark;
- `refillArray` in `packages/core/src/configuration/configurationSchema.ts`
  works around the fork's quadratic array reconcile, which
  `@jbrowse/mobx-state-tree` 6.6.1 made linear; measure a 5,000-name reorder
  through plain assignment and drop the refill if it holds.
