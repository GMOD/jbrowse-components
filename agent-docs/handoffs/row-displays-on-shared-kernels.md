---
name: row-displays-on-shared-kernels
description: "A 2026-10-02 audit of the multi-sample variant, multi-row feature and MAF displays against the grammar's one-object rule. Its bugs 1-7, the phased-dialog gate, MAF's shared identity predicates and N rule, the MAF cleanups and the shared insertion mark landed the same day, row colour on 2026-10-03 (ADR-207) and the variant wire shape on 2026-10-04 (ADR-210); open are per-mark seams."
---

# Row displays on shared kernels

On 2026-10-02 Colin asked for simplifications, refactors and bug fixes in the
multi-sample variant, multi-row feature and MAF displays, suspecting unfinished
work aligning them on mark-based drawing. Four Opus audits read the code against
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md) rule 2,
[ADR-199](../architecture-decision-records/adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md)
and
[one-row-model](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md);
bugs 1-5 were re-read by hand. Two Opus agents landed bugs 1-7, the first half
of 9, convergence 3 up to the shared predicates and the MAF cleanups the same
day; what follows is what is left.

## Where the drawing stands

Each display's main layer already runs through `defineMark` and
`createMarkBackend`: multi-row through render-core's `spanMark`
(`plugins/canvas/src/LinearMultiRowFeatureDisplay/rendering/multiRowMarks.ts`),
MAF through span, bar and coverage-band marks
(`plugins/maf/src/LinearMafRenderer/mafMarks.ts`), the variant display through
its own `cellMark` and `matrixCellMark` over `variant.slang` and
`variantMatrix.slang`, which rule 2 accepts. Off the marks: the
insertion counts, the matrix's connector lines, multi-row's density
band, MAF's seven overlays, and the row and data plumbing around the marks.
So the direction is ADR-199's — share kernels where two paths compute the same
thing — not ports onto `LinearMarkDisplay`.

## Open bugs and calls

Row colour landed whole on 2026-10-03 as
[ADR-207](../architecture-decision-records/adr-207-a-rows-colour-resolves-once-and-shows-beside-its-label.md):
one resolution, a label bar, groups as attributes, one key and one dialog.

- **Multi-row `facet` on a feature field is a notice** (`rowBandingNotices`):
  a row carries only its name and `group`, and banding by a feature attribute
  would split rows in the worker. Nobody has asked for more.

## Convergence, in order

1. **The insertion mark landed 2026-10-02**: alignments-core's
   `insertionMark` (`x`, `x2`, `row`, `length`, `color`, optional `under`)
   over render-core's `insertionGlyph.slang`, drawn by variants, multi-row and
   MAF on all three backends. The pileup keeps its own `INSERTION_MARK`, since
   its fades, hit rules and uniforms are the pileup's, and shares the glyph
   module. The counts are text, so each display keeps a Canvas2D layer for them
   (`paintInsertionLabels`), and multi-row's for its deletion lines too. Left:
   multi-row's hit test (`hitTesting.ts`) answers the block, not a marker
   wider than it, though `hoverInk` draws both; the mark display's `cells`
   insertions need an `insertion` mark type ([maf-on-the-mark-display](../ideas/collections/maf-on-the-mark-display.md) item 6); MAF walks
   a region's insertions eagerly on the main thread per fetch, about a fifth
   of what `buildMafChannels` already costs over the same blocks, so both
   encodes moving to the worker is the fix, not a lazy index; and no test runs
   `insertionMark.slang`'s vertex geometry, only its Canvas2D twin.
2. **Multi-row onto shared kernels**: clustering bins on `binColumns` and the
   worker reads `rows`/`clusterField` through `fieldReader` now. Left: the
   presence/categorical encoding into tree-sidebar so the mark display can
   cluster span rows; the candidate scan on canvas's
   `summarizeGroupByCandidates`.
3. **One MAF identity walk** stops at shared predicates: core's
   `util/alignedBytes.ts` holds the byte constants, `firstDrawn`/`lastDrawn` and
   the base tests, and a reference `N` counts toward no identity in core, MAF
   and clustering alike. Merging `buildIdentityRuns` onto `binnedCellMatches`
   was tried and declined: they read different inputs (the `MafBlock` arena
   against feature-table texts), return different shapes (hundredths over the
   counted bases against bin-edged groups with ids and hover JSON), and core
   makes groups for gap-only runs where MAF emits nothing.
4. **Per-mark `minWidthPx`/`seamPx` on the mark display**:
   [maf-on-the-mark-display](../ideas/collections/maf-on-the-mark-display.md)
   item 2.

## Simplifications

- **The variant wire shape landed 2026-10-04** as
  [ADR-210](../architecture-decision-records/adr-210-both-variant-layouts-ship-one-cell-payload.md):
  one `VariantCellData` per block from one cell loop, the `cell` mark's span
  and glyph dealt from the records on the main thread. Left: the `cell`
  shader could read them from a per-record table instead, which the HAL's one
  RGBA8 texture per pass and its re-upload on identity do not yet carry (the
  ADR's Rejected rows).
- `spatialIndex` is the same `buildSpatialIndex(self.hierarchy)` on five
  displays, but the mixin owns no `hierarchy`.
- MAF: the coverage band hard-codes a linear scale four times
  (`stateModel.ts:1592-1664`), the shape `scales.y` would replace when its
  trigger comes.

## Not proposed

The variant cells onto `spanMark` (~400 lines of render-core to delete ~350);
MAF onto the mark display (ADR-199); an ordinal x for the matrix and LD; a
helper per repeated menu action; the MAF band's `scales.y` before its
trigger.
