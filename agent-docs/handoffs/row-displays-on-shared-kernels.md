---
name: row-displays-on-shared-kernels
description: "A 2026-10-02 audit of the multi-sample variant, multi-row feature and MAF displays against grammar-unity: every main layer already draws through render-core marks, so what is left is verified bugs, an insertion mark whose trigger is met, kernels shared in name only (MAF identity, multi-row clustering and hit test), the one-row-model doc's orphaned step 7, and stale docs. Colin decided a reference N does not count toward identity; the palette half of step 4 is not wanted now."
---

# Row displays on shared kernels

On 2026-10-02 Colin asked for simplifications, refactors and bug fixes in the
multi-sample variant, multi-row feature and MAF displays, suspecting unfinished
work aligning them on mark-based drawing. Four Opus audits read the code against
[grammar-unity](grammar-unity.md),
[ADR-199](../architecture-decision-records/adr-199-the-maf-display-stays-its-own-and-shares-the-grammars-kernels.md)
and
[one-row-model](../ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md);
bugs 1-5 were re-read by hand. Nothing was changed.

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

## Bugs, in order

1. **MAF identity key shows the ramp at 1-4 bp/px**, where every cell is 0 or
   100%. The key switches on `zoomedToBaseLevel` (`coarseBpPerPx <= 1`,
   `plugins/maf/src/LinearMafDisplay/stateModel.ts:1947`) while
   `subPixelBinBp` keeps 1 bp bins below `MIN_BINNED_BP_PER_PX = 4`
   (`packages/display-kit/src/subPixelBinBp.ts`). Gate the key on the encode's
   `binBp === 1`.
2. **MAF insertion hover box ignores row height**:
   `components/findRowHover.ts:218` calls `insertionBarWidth` without the
   row's height, so on rows under 5 px the box is the full label width and
   steals the neighbouring bases. Every other caller passes it.
3. **Multi-row clustering drops features narrower than a bin**: a feature
   counts only where it covers a bin's midpoint
   (`plugins/canvas/src/MultiRowClusterFeaturesRPC/buildMultiRowMatrix.ts:157`).
   Under the categorical encoding (200 bins) anything up to ~5 kb clusters as
   empty while still drawn. `binSpan`/`columnSegments`
   (`packages/tree-sidebar/src/binColumns.ts`) count it in its start column,
   as the mark display's `collectMarkRowMatrix.ts` already does.
4. **Multi-row `color.domainQuantile` weighs distinct values**:
   `plugins/canvas/src/shared/featureColorViews.ts:110` reads
   `rectColorValues`, which multi-row ships as `featureColorValues`
   (`MultiRowGetFeaturesRPC/rpcTypes.ts`). Rename the field.
5. **The variant display shows no colour notices**: no `notices` getter and no
   `ConfigProblemsIndicator`, so a threshold/range or labels/domain mismatch
   is silent on screen and in `display.notices`. `colorNotices(colorSetting,
   CATEGORICAL_FIELD_PRESETS)` plus the indicator in both chromes. Check
   whether multi-row mounts the indicator for the `notices` it computes.
6. **Multi-row silent no-ops**: `rowColorDealFor` (`model.ts:377`) drops its
   setting, so `rowColor.field` is ignored; `facet` on any field but `group`
   draws nothing, since `discoveredRows` carries only name and label; `rows`
   and `clusterField` read a bare `feature.get`
   (`packMultiRowFeatures.ts:215`), so a dotted path draws one `''` row while
   `color.field` in the same packer uses core's `fieldReader`.
7. **The matrix tooltip re-derives "carries alt"**
   (`VariantMatrixComponent.tsx:103`) instead of reading the
   `cellAltDosage` ADR-203 ships; that retires `cellCarriesAlt`.
8. **Coverage band seam on reversed blocks**: 71e959da59 fixed `spanMark` and
   `barMark`; alignments-core's `drawCoverageBins` (`rendererUtils.ts:212`)
   still pads rightward. Low.
9. Still live from
   [row-display-followups](../ideas/collections/row-display-followups.md):
   the phased dialog writes the sample order (gated on `adapterSamples`, not
   `samplePloidy`, `multiSampleVariantMenuItems.ts:431`), and a recolour under
   `rowColor: { scale: 'none' }` turns the palette on for every row.

## Convergence, in order

1. **An insertion mark in alignments-core.** Variants
   (`drawVariantInsertionGlyphs.ts`, 251 lines), multi-row
   (`drawMultiRowIndelGlyphs.ts`, 148) and MAF (`rendering/insertions.ts` and
   its walkers, ~305) each paint through `drawInsertionMarker` in Canvas2D;
   alignments has the GPU mark (`plugins/alignments/src/features/insertion/mark.ts`).
   They have drifted: MAF's count label is hard-coded white, variants use their
   own luminance formula against core's `getContrastText`, and bug 2 is the
   same drift in a hover box. Moving the mark to alignments-core with x, row,
   length and colour channels retires the three overlays and gives the mark
   display's `cells` insertions a glyph (maf-onto-marks item 8).
2. **Multi-row onto shared kernels**: clustering on `binColumns` (bug 3), then
   its presence/categorical encoding into tree-sidebar so the mark display can
   cluster span rows; hit test on render-core's `rowSpanIndex` instead of a
   per-row bucket walk (`hitTesting.ts:98`); worker field reading on
   `fieldReader`/`valueText` (bug 6) and the candidate scan on canvas's
   `summarizeGroupByCandidates`. The "hidden feature" rule runs three times
   (`multiRowChannels.ts:52`, `featurePainting.ts:94`, `rowOrderByValueAt.ts:22`);
   the overlay and sort can read the encoded channels and row table.
3. **One MAF identity walk.** `buildIdentityRuns`
   (`plugins/maf/src/LinearMafRenderer/identity.ts:139`) and core's
   `binnedCellMatches` (`packages/core/src/util/cellMatches.ts`) differ on a
   reference `N` (MAF excludes it, core's `cellState` has no case), rounding
   (MAF to hundredths, merging equal bins) and extent; the hover's
   `identityOver` and clustering's `buildIdentityMatrix.ts:287` are a third and
   fourth `N` policy. **Colin, 2026-10-02: an `N` does not count toward
   identity**, so core's `cellState` takes MAF's rule and the walks can merge.
   The per-column predicates are restated byte for byte and can share first:
   `alignedExtent.ts` against `firstDrawn`/`lastDrawn` in `cellsStep.ts`,
   `classifyCell` against `cellState`, the byte constants in both. The bench's
   "worst error 0.00" holds only because its fixtures have no reference `N`;
   add one.
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
  `applyClusterOrder.ts` restates `applyClusterRun`. `svgSidebarWidth` is a
  mixin method now ([svg-sidebar-text-style](svg-sidebar-text-style.md));
  `spatialIndex` is the same `buildSpatialIndex(self.hierarchy)` on five
  displays, but the mixin owns no `hierarchy`, so it moves with step 5's hook
  seam.
- MAF: `ROW_RENDERINGS` restates `MAF_COLOR_FIELDS` unchecked
  (`rowRenderings.ts`); dead `makeCellPxRange`, `MafRenderBlock`,
  `MafSamplesResult`; the coverage band hard-codes a linear scale four times
  (`stateModel.ts:1592-1664`), the shape `scales.y` would replace when its
  trigger comes.
- Multi-row keeps pre-ADR-157 names (`partitionField`,
  `effectivePartitionField`, "Partition by...").
- Stale comments: `mafHitTest.ts:92` and `trackMenuItems.ts:305` (listed in
  maf-onto-marks and never fixed) plus `drawMafBlocks`, `buildInstanceBuffer`,
  `drawConservation`, `eachVisibleRow`, `discoveredOrder`,
  `sampleSetGeneration` named in MAF comments; about 25 "two displays"
  comments in variants since the merge; `shadeByDosage` "is a fetch input"
  (`multiSampleVariantMenuItems.ts:290`) and the colord blend in
  `getPhasedColor.ts`, both false since ADR-203; `rowBand.ts:10` names
  consumers that moved; `activeFilters()` is now `configuredFilters()`.

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
