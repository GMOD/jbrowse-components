---
name: multi-display-review-2026-09-01
description: The 2026-09-01 review of the four multi/row displays (multi-wiggle, the two multi-sample variant displays, the multi-row feature painting, MAF) and the shared tree-sidebar machinery — every verified finding, which ones landed in wave one, which are still in flight in four per-plugin agents, and the wave-two cross-cutting list that has to touch every plugin's model at once. Pick up here rather than re-reviewing.
---

# Multi display review, 2026-09-01

Five parallel review passes (one per display family, one over
`packages/tree-sidebar`) produced the findings below. The top claims were
re-verified at the cited lines. Nothing in
`ideas/row-display-followups.md` was re-proposed.

## How the implementation was run

Wave one: five Opus agents in ONE shared working tree, each owning a
disjoint directory, committing with explicit pathspecs. Ownership was:
`plugins/wiggle` + `packages/wiggle-core/src/autoscale.ts`,
`plugins/variants`, `plugins/canvas`, `plugins/maf`,
`packages/tree-sidebar` + `packages/core/src/util/{rowStackGeometry,useRowVirtualScroll,usePanelVirtualScroll}.ts`.
Wave two (not started) is the cross-cutting work that must touch every
plugin's model, so it could not run concurrently.

Commits from this session carry
`Claude-Session: https://claude.ai/code/session_014psJ3MEcdh1mzRbfJb7z5j`.
`git log --grep session_014psJ3MEcdh1mzRbfJb7z5j` lists what landed.

Note for whoever resumes: `pnpm lint --cache` is rejected by this oxlint (the flag in `~/.claude/CLAUDE.md` is stale),
and `pnpm format <files>` ignores its arguments and formats the whole repo;
use `pnpm exec oxfmt <files>`.

## Landed in wave one (shared package, complete)

- `bulkEditParse.ts` no longer trims leading tabs, so a TSV row with an
  empty first cell keeps its columns.
- `TreeLayoutModel.editableSources`, `TreeSidebarModel.sources`,
  `TreeDrawingModel.sources`, `setClusterRegion` are required; fallbacks
  removed. `setScrollTop` stayed optional because
  `plugins/wiggle/src/MultiLinearWiggleDisplay/components/multiWiggleDisplayTypes.ts`
  does not declare it (wave two).
- `RowSeparatorLines.minRowPx` removed (no caller).
- `packages/tree-sidebar/src/clusterMatrix.ts` refuses n<2 once
  (`MIN_CLUSTER_ROWS`); `clusteringMenuItem(self, runItem, rowCount?)`
  owns disabled + help text when given a count.
- `rowSortAutorun`: `sortRows` may return `false` to keep `sortRowsBy`;
  `sortRowsAtColumn` returns whether it sorted, and has tests.

## In flight in wave one (per-plugin agents, check git log per directory)

Each agent was told to commit per item. Verify with
`git log --oneline -- <dir>` and `npx jest <dir> --reporters=default`.

**wiggle** — COMPLETE, all ten items committed (`ca8e03ee98` … `949485fd2d`),
75 suites green. Still owed: `pnpm autogen` for
`website/docs/config/MultiLinearWiggleDisplay.md`, and a component test for
the crosshair (no wiggle component test exists in jsdom).
Items (`plugins/wiggle/src/MultiLinearWiggleDisplay`): sort-by-score
reads `getEffectiveScores(mode)` not the average; cluster caption records
the parsed `samplesPerPixel`; NaN skipped in `autoscale.ts` stats so the
domain does not collapse to the `[0,1]` stub; crosshair no longer gated on
`hoveredFeature`; overlay legend gated on `legendIsReadable` (palette wraps
at 9); context menu gains "Open feature details" / "Copy location"; dead
`regions ??` fallbacks and `showAdvanced` removed; `RenderMultiWiggleData`
args type names `summaryScoreMode`; `defaultRendering` doc lists the two
`*linecenter` modes; `matrixKey` is a stable key not the MST model.

**variants** — COMPLETE, all eleven items committed, 118 suites green.
Variants already forwards the sort boolean (wave two can drop that row for
variants). `focusGroup` now reads a new `sourcesBeforeSubtreeFilter`
getter; `hasClusterableRows` counts `sources`; `sourcesWithoutLayout` is
gone. The three variant model doc pages under `website/docs/models` were
regenerated and committed with it.
Items (`plugins/variants`): phased legend focus (`focusGroup`
collected haplotype names, `sourcesBase` filtered sample names → zero rows);
`rowOrderIsCustom` compared a `sampleName`-stamped layout to a raw one so
"Reset row order" never cleared; `sortRowsByGenotypeAt` decline; "Group
by…" submenu (slot + action existed, no menu); "Show reference alleles"
lifted to the matrix display; `showLegend` added to `PORTABLE_CONFIG_KEYS`;
matrix tooltip insertion per haplotype row (`cellAltDosage` parity); wheel
bound to the panel so the dendrogram scrolls rows; right-click sort through
`sortRowsHereMenuItem`; `hasClusterableRows` gates on the list clustered;
`RectBg.tsx` and dead `ReducedModel` fields removed; stable `matrixKey`.

**canvas multi-row** (`plugins/canvas/src/LinearMultiRowFeatureDisplay`):
derived `height` floored at `MIN_DISPLAY_HEIGHT` (pinned rowHeight + no
rows gave a 14px track under the density band); configured `legend` slot no
longer floats over the band; sub-pixel `featureAt` tolerance
(377ead8f71); pixel-centre row rule via `rowStackGeometry` (3e5b4ccc7b);
partition pin read off `rpcDataMap` not `drawnRegionData` (refetch loop +
empty Partition submenu under the band); `rowOrderByValueAt` comment vs
`editableSources`; tooltip shows indel magnitude; `DensityBandMixin`
extracted from the block duplicated with `LinearBasicDisplay/baseModel.ts`;
hit-test cluster and partition views moved out of `model.ts`;
`MultiRowClusterDialog` type + stable `matrixKey`.

**maf** — COMPLETE except three items, 95 suites green. Not done:
(a) `LegendMixin` for MAF: fully built and reverted because it fails
`products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts` (needs a
`LinearMafDisplay` fixture there) and the `ConfigSlotDefaults` snapshot;
the working patch is at the session scratchpad
`item9-legend-mixin.patch` and may be gone, so rebuild from the wiggle
model's `showLegend` shape and land it with those two web-side edits.
(b) Lazy Launch submenu: `SubMenuItem.subMenu` has no function form
(`packages/core`); the `rows.find` per block was replaced by one pass
(`findRowSpans`), measured 2.0x on the 464-row shape. (c) Pan-stable
`legendItems` was tried and reverted (no read expresses "a CDS is on
screen"); the extraction of argument-taking views out of `stateModel.ts`
was not started. Item 6's premise was corrected: bands only overlap below
1px/row, and the fix uses `rowsUnderPointer` with a gutter fallback.
Items (`plugins/maf`): minus-strand insertion widget span
(`forwardPos` mirrors, `pos` is the highest coordinate); multi-region
selection clipped like `selectionRegion` (Launch items mixed chromosomes);
identity matrix per-region segments (4614838f16); drag readout Length
(8e8ea74277); "Sort rows by base here" disabled on the summary tier
(d8f5a60f3e); `mafHitTest` uses `rowsUnderPointer`; lazy Launch submenu or
`rowIndexBySrc` (track menu open scanned every buffered block per row);
context menu "Copy location" + open insertion widget; `LegendMixin` with
`showLegend`, dismiss, export gating; `clusterProvenance` passed to
`SvgTreeSidebar` in export; `TrackBandCanvas` draw dep churn;
`legendItems` pan-stable; argument-taking views out of `stateModel.ts`.

## Wave two (cross-cutting, one agent after wave one is committed)

- Add `setScrollTop` to `multiWiggleDisplayTypes.ts`, then make
  `TreeSidebarModel.setScrollTop` required (`types.ts`) and drop the `?.()`
  in `focusRows.ts`.
- Pass `rowCount` to `clusteringMenuItem` at
  `wiggle/model.ts` (~576, keep `isOverlay` in disabled),
  `canvas/trackMenuItems.ts` (~262), `maf/trackMenuItems.ts` (~304); leave
  variants (its help text distinguishes loading from one sample). Delete
  the per-display `< 2` spellings that the shared refusal now covers; the
  two admitting one row are `runMafClustering.ts` (`!sources.length`) and
  `runGenotypeClustering.ts` (`if (sourcesBase)`).
- Forward the sort boolean: `setupMultiSampleVariantAutoruns.ts` ~23,
  `wiggle/model.ts` ~516, `canvas/model.ts` ~1502, `maf/stateModel.ts`
  ~2529; variants' `sortRowsByGenotypeAt` returns `false` on both declines
  (unless the variants agent already sorted to the nearest record).
- `showRowSeparators` slot + getter + setter is copied in wiggle, canvas and
  variants with drifted descriptions; move into
  `treeSidebarConfigSchemaFields` + `TreeSidebarMixin`. MAF has none
  (deliberate, see row-display-followups).
- Clustering under a subtree filter has two semantics: wiggle/canvas cluster
  all rows and prune the tree, variants/maf cluster the clade (and a chip
  click then hides the tree behind the stale hint). Decide one; the
  wiggle/canvas commit code is identical modulo the list
  (`runWiggleClustering.ts` ~50 vs `runMultiRowClustering.ts` ~62, and the
  two dialogs' manual `applyOrder`), so a shared `commitClusterRun` falls
  out of the decision.
- `focusLegendGroup` (wiggle ~432) and `focusGroup` (variants ~1546) differ
  only in the predicate.
- `RowLabelsOverlay.tsx:67` `sources: RowLabelSource[] | undefined` is the
  same dead optionality; tighten with its plugin callers.
- `TreeDrawingModel` is passed to `addDisposer`/`isAlive` but does not
  extend `IStateTreeNode`.
- Rename one of the two unrelated `sourcesLogic.ts` files (wiggle's is a
  color model, canvas's is row grouping).
- MAF `stateModel.ts` is 52% comments, mostly history; move the "why"
  paragraphs into `reference/MAF_*.md`.

## Deliberately not done

- Multi-row fixed-mode drag re-pins `rowHeight` against the filtered
  `nrow` (focus 4 of 40, drag, clear → 4000px track). Documented as
  deliberate in `ROW_HEIGHT_AND_FIT.md`; a fix means a scroll viewport.
- `computeVariantCells` / `computeVariantMatrixCells` share ~130 lines;
  merging needs the 2504×400 A/B `MULTI_SAMPLE_VARIANTS.md` requires.
- Collapsing `showReferenceAlleles` into `referenceDrawingMode` is a
  published-config decision.
- Multi-row jexl "Filter by…" (LinearBasicDisplay has it on the same data)
  and a per-feature "Color by…" menu are new UI, not fixes.
- Multi-wiggle has no `gateEnabled`; recorded as deliberate in
  `regionTooLargeConfigSchemaFields.ts`.
- Wiggle and canvas `useMouseState` in the body rather than `PointerLayer`
  (wiggle only; low).

## Feature matrix

The cross-cutting review's per-display table (row height, scroll, hit-test
rule, sources chain, clustering list, legend, export, gate) was not saved to
the tree. The rows that drove wave two are the ones above; regenerate it
from the models if another consistency pass is wanted.
