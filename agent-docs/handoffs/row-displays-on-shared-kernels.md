---
name: row-displays-on-shared-kernels
description: "A 2026-10-02 audit of the multi-sample variant, multi-row feature and MAF displays against grammar-unity. Its bugs 1-7, the phased-dialog gate, MAF's shared identity predicates and N rule, and the MAF cleanups landed the same day; open are two product calls on row colour, a coverage seam, an insertion mark whose trigger is met, multi-row's hit test and hidden-feature rule, per-mark seams, the one-row-model hook seam, variant wire shapes and stale docs."
---

# Row displays on shared kernels

On 2026-10-02 Colin asked for simplifications, refactors and bug fixes in the
multi-sample variant, multi-row feature and MAF displays, suspecting unfinished
work aligning them on mark-based drawing. Four Opus audits read the code against
[grammar-unity](grammar-unity.md),
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
`variantMatrix.slang`, which grammar-unity accepts. Off the marks: three
Canvas2D insertion overlays, the matrix's connector lines, multi-row's density
band, MAF's seven overlays, and the row and data plumbing around the marks.
So the direction is ADR-199's — share kernels where two paths compute the same
thing — not ports onto `LinearMarkDisplay`.

## Open bugs and calls

1. **Coverage band seam on reversed blocks**: 71e959da59 fixed `spanMark` and
   `barMark`; alignments-core's `drawCoverageBins` (`rendererUtils.ts:212`)
   still pads rightward. Low.
2. **A recolour under `rowColor: { scale: 'none' }` turns the palette on for
   every row** (from
   [row-display-followups](../ideas/collections/row-display-followups.md)).
   Reproduced; a grid recolour needs the dialog's "Each row" choice, which on
   multi-row deals the palette to every row. Recolouring one row while the rest
   stay unpainted needs a "named colours, no palette" state the `rowColor`
   vocabulary lacks — a call for Colin, not a bug fix.
3. **Multi-row `rowColor: 'group'` deals palette colours per group**, not each
   group's `rowGroups[].color`; the deal reads a row's group off its name
   through `rowGroupMatchers`, which is what retires e735d1a14d's per-row
   stopgap. Whether `rowGroups[].color` should win there is open, and ties to
   step 4's palette flip, not wanted now.
4. **Multi-row `facet` on any field but `group` or `name` is a corner notice**:
   a row carries no other attribute, and banding by a feature attribute would
   split rows in the worker.

## Convergence, in order

1. **An insertion mark in alignments-core.** Variants
   (`drawVariantInsertionGlyphs.ts`, 251 lines), multi-row
   (`drawMultiRowIndelGlyphs.ts`, 148) and MAF (`rendering/insertions.ts` and
   its walkers, ~305) each paint through `drawInsertionMarker` in Canvas2D;
   alignments has the GPU mark (`plugins/alignments/src/features/insertion/mark.ts`).
   They have drifted: MAF's count label is hard-coded white, variants use their
   own luminance formula against core's `getContrastText`, and MAF's insertion
   hover box ignored row height until 2026-10-02. Moving the mark to alignments-core with x, row,
   length and colour channels retires the three overlays and gives the mark
   display's `cells` insertions a glyph (maf-onto-marks item 8).
2. **Multi-row onto shared kernels**: clustering bins on `binColumns` and the
   worker reads `rows`/`clusterField` through `fieldReader` now. Left: the
   presence/categorical encoding into tree-sidebar so the mark display can
   cluster span rows; hit test on render-core's `rowSpanIndex` instead of a
   per-row bucket walk (`hitTesting.ts:98`); the candidate scan on canvas's
   `summarizeGroupByCandidates`. The "hidden feature" rule runs three times
   (`multiRowChannels.ts:52`, `featurePainting.ts:94`, `rowOrderByValueAt.ts:22`);
   the overlay and sort can read the encoded channels and row table.
3. **One MAF identity walk** stops at shared predicates: core's
   `util/alignedBytes.ts` holds the byte constants, `firstDrawn`/`lastDrawn` and
   the base tests, and a reference `N` counts toward no identity in core, MAF
   and clustering alike. Merging `buildIdentityRuns` onto `binnedCellMatches`
   was tried and declined: they read different inputs (the `MafBlock` arena
   against feature-table texts), return different shapes (hundredths over the
   counted bases against bin-edged groups with ids and hover JSON), and core
   makes groups for gap-only runs where MAF emits nothing.
4. **Per-mark `minWidthPx`/`seamPx` on the mark display**: `markList.ts`
   hands every span the display's one `minWidthPx` and a seam of 0 (bar now
   takes `CANVAS_SEAM_PX`), so it cannot reproduce MAF cells
   (`minWidthPx: 0`, `seamPx: GAP_STROKE_OFFSET`). The row offset has two
   spellings, `scrollTop` on span and `rowOffsetPx` on the rest.
5. **one-row-model step 7, the hook seam**, which no handoff tracked after
   grammar-unity replaced that doc's order of work. `TreeSidebarMixin()` takes
   no options; displays override 3-8 hooks each, many returning constants
   (`identityChannel`, `rowColorFields`, `rowColorDealFor`). Members outside
   the hook list are overridden anyway: MAF `clusterableSources`, wiggle
   `rowStylingIsCustom`, multi-row `effectiveRowHeight`. With
   `identityChannel` an option, the four ~33-line row-arrangement dialog
   wrappers (multi-row, MAF, mark, variants' `SetColorDialog.tsx`) collapse.
   Step 4's palette flip and its retirements (`colorRowLabels`,
   `rowGroups[].color`, `rowGroupLegend`, `getSampleGroupEntries`) are not
   wanted now (Colin, 2026-10-02).

## Simplifications

- **Variant wire shapes**: genomic ships `perRegionCellData` keyed by feature
  id, columns one flat payload with positional `featureData[]`
  (`executeVariantCellData.ts:100`), so about a dozen getters fork
  (`regionCellColors`/`matrixCellColors`, `placed*Rows`,
  `perRegionCellMap`/`placedMatrixData`, `getOrderedGenotypeCodes`,
  `paintedDomain`, `laneFeatureInfo`). `matrixRegions` already presents the
  matrix as region 0; ship it that way. The wire's `regular`/`matrix` against
  the slot's `genomic`/`columns` goes with it.
- **`MultiSampleVariantBaseModel`** (1,736 lines) has one consumer
  (`LinearMultiSampleVariantDisplay/model.ts:124`); merging it follows "keep
  the main model chain in one file" and drops the super-capture overrides and
  casts. Check MST type depth first.
- The two cell loops share a two-ended bucket writer
  (`computeVariantCells.ts:117-294`, `computeVariantMatrixCells.ts:86-191`);
  both variant chromes and MAF's mount the same scroll/sidebar/overlay tree;
  `applyClusterOrder.ts` restates `applyClusterRun`. `spatialIndex` is the
  same `buildSpatialIndex(self.hierarchy)` on five displays, but the mixin owns
  no `hierarchy`, so it moves with step 5's hook seam.
- MAF: the coverage band hard-codes a linear scale four times
  (`stateModel.ts:1592-1664`), the shape `scales.y` would replace when its
  trigger comes.
- Multi-row keeps pre-ADR-157 names (`partitionField`,
  `effectivePartitionField`, "Partition by...").
- Stale comments: about 25 "two displays" comments in variants since the
  merge; `rowBand.ts:10` names consumers that moved; `activeFilters()` is now
  `configuredFilters()`.

## Stale docs

- [multi-sample-variant-display](../ideas/collections/multi-sample-variant-display.md)
  tells GQ masking, pedigree and haplotype blocks to bake into `cellColors`
  worker-side "where the `color` hue already applies" — false since ADR-203,
  and it steers them against ADR-202/203.
- `PLOT_VOCABULARY.rowColor` (`packages/core/src/configuration/plot.ts:26`)
  says "the colour of each row label"; on multi-row it paints the blocks.
- grammar-unity calls the colour builder step 2 and wiggle steps 3 and 5
  against its own numbered list, and its `rowBanding` pointer has drifted to
  `TreeSidebarMixin.ts:456`.
- maf-onto-marks names `LinearMafDisplay/components/rendering`, which does not
  exist; the overlays are `components/*Overlay.tsx`, the painters
  `LinearMafRenderer/rendering/`.

## Not proposed

The variant cells onto `spanMark` (~400 lines of render-core to delete ~350);
MAF onto the mark display (ADR-199); an ordinal x for the matrix and LD; a
helper per repeated menu action; `MafColor` and the MAF band's `scales.y`
before their trigger.
