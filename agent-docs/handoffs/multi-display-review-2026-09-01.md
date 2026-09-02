---
name: multi-display-review-2026-09-01
description: The 2026-09-01 review of the four multi/row displays (multi-wiggle, the two multi-sample variant displays, the multi-row feature painting, MAF) and the shared tree-sidebar machinery — every verified finding, what landed in wave one, what the wave-two cross-cutting pass did to every plugin's model at once (including the clustering-under-a-filter decision and the one item argued down), and what is still owed. Pick up here rather than re-reviewing.
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
Wave two is the cross-cutting work that must touch every plugin's model, so
it could not run concurrently; it ran on 2026-09-02 in its own worktree and
is written up below.

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
(a) `LegendMixin` for MAF: built and reverted because it failed
`products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts` and the
`ConfigSlotDefaults` snapshot. **Landed 2026-09-02** with both web-side
edits — see "Landed since" below.
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

## Wave two (cross-cutting) — done 2026-09-02

One agent in its own worktree (`.claude/worktrees/wave-two-cross-cutting`),
ten commits, `git log --grep session_01U9NmHGZm4qBDjWLrP7fYER`. Every item on
the list below landed except the last, which is argued down rather than done.

- `setScrollTop` is declared on `multiWiggleDisplayTypes.ts` and required on
  `TreeSidebarModel`; `focusRows` lost its `?.()`.
- `clusteringMenuItem(self, runItem, rowCount)` — `rowCount` is **required**,
  and the gate composes rather than replaces: a run row the display already
  disabled passes through with its own text, so MAF and the variant displays
  keep "Loading rows/samples..." and multi-wiggle keeps "Only available for
  multi-row rendering types" while the count rule lives in one place. All four
  pass it (the handoff's "leave variants" is moot under the composing form).
  The `< 2` spellings went with it: multi-wiggle's dialog `canRun` (which
  admitted one row), its bespoke throw, and the guards inside
  `runWiggleClustering` / `runMultiRowClustering` / `runMafClustering` — every
  entry point is gated above them and `clusterMatrix` refuses n<2 into the
  dialog's error state. `runGenotypeClustering`'s `if (sourcesBase)` stays: it
  is an undefined-narrowing, not a count.
- The sort boolean is forwarded on all four. MAF's `sortRowsByBaseAt` went
  through `sortRowsAtColumn` while there — it held the fourth hand-written copy
  of the region resolution and the two declines.
- `showRowSeparators` is `rowSeparatorsConfigSchemaFields`, spread beside
  `treeSidebarConfigSchemaFields` rather than folded into it: MAF composes the
  sidebar and draws no separators, and a slot it ignored would read as one it
  honors. **The getter and setter stay per display** — the mixin declares the
  sidebar's three because this package reads them, nothing here reads this one,
  and declaring it would hand MAF a `getConf` for a slot it does not have. The
  description carries the whole explanation, per
  `rowHeightConfigSchemaFields`: a spread slot renders on its config page from
  that string alone, so the two pages that had a short description or none
  gained the prose the third had.
- **Clustering under a subtree filter clusters the clade** (Colin's call), so
  multi-wiggle and the multi-row painting stopped sending the whole cohort.
  `clusteredCladeLayout` in tree-sidebar is MAF's `clusteredMafLayout` promoted
  to the one commit path — both dialogs' R-paste path picks up its
  `matrixRowNames` drift check with it. The rows are a new
  `clusterableSources` getter (`editableSources` narrowed by the filter),
  never the drawn `sources`: both displays decorate on the way to the painting
  and `applyLayoutOverrides` would write a synthesized palette color into
  `layout`. The known cost of the clade reading is that clearing the filter
  leaves a tree that no longer names the rows, so `StaleTreeHint` replaces the
  dendrogram until the next run.
- `focusRowGroup(model, rows, inGroup)` is the shared write behind a legend
  swatch; the two displays keep only their predicate.
- `RowLabelsOverlay`'s `sources` is required, `TreeDrawingModel extends
  IStateTreeNode`, and canvas's `sourcesLogic.ts` is `rowSources.ts` (the
  wiggle one, the colour model, keeps the name its CLAUDE.md cites).
- **MAF `stateModel.ts`'s comments: examined, deliberately not moved.** The
  premise ("52% comments, mostly history") does not survive reading them. The
  file is 1362 comment lines in 26 blocks of 15+; the ones sampled —
  `setSamples`' union-vs-replace rule, `activeRowRendering`'s precedence,
  `visibleSummaryBars`' swap-back-in, `sourceChromRanks`' `renderBlocks` memo
  key, `regionHasData`'s two-tier cache — are rationale that guards a specific
  regression, several naming the test that pins it, and each renders into
  `website/docs/models/LinearMafDisplay.md` as the member's documentation.
  Moving them to `reference/MAF_*.md` would strip the model page and put the
  warning a `git blame` away from the code it is about. The genuinely dead
  history is a few clauses, not paragraphs. Don't re-propose this without
  naming the specific block.

## Landed since, off the wave-one "still owed" list

- **MAF's `LegendMixin` is in** (the reverted item 9(a)). The patch that was
  parked beside this file is applied and deleted. The two web-side edits it
  was blocked on are a `LinearMafDisplay` fixture in `PromotablePinCoverage`
  and the `ConfigSlotDefaults` snapshot. What changed from the parked version:
  the menu row is gated on a new `hasLegendKey` (a fact about the active
  rendering) rather than on `legendItems.length`, which declines on an
  uninitialized view and would take the way back to a dismissed key away while
  a track was loading — that is also what lets the fixture reach the pin
  without fetching. The patch also carried a CDS-frame-key test belonging to
  the reverted pan-stable `legendItems` work; it was dropped with it.
- `pnpm autogen` for the wiggle docs (part of the wave-two commits).

## Still owed

- **`LinearMultiRowFeatureDisplay pins every promotable slot its menu should`
  is red on main**, and is not wave two's: a configured `legend` with nothing
  painted yet drops the "Show legend" row and the pin with it. Another session
  had the fix (`hasLegendToShow`) uncommitted in the primary checkout on
  2026-09-01. **Name it the same as MAF's `hasLegendKey` when it lands** — one
  idea, and the second display to need it wrote a second name.
- `ConfigSlotDefaults`' snapshot was also stale for `densityTier` /
  `densityAdapter`; the MAF legend commit's `-u` picked those up.
- Eight generated artifacts are stale on main (`agent-docs/ARCHITECTURE.md`,
  `handoffs/README.md`, `packages/core/README.md`, the desktop MCP
  `typeDocs.generated.json`, `website/docs/api/core-util.md`,
  `mst_patterns.md`, `models/LGVSyntenyDisplay.md`, `models/LinearGenomeView.md`).
  A `pnpm autogen` in this worktree rewrote them and they were reverted rather
  than swept into an unrelated commit — the primary checkout had the same eight
  dirty, so someone is on them.
- `pnpm autogen`'s doc-snippets generator refuses on main: 49 hand-written
  TS/JS fences against a baseline of 24. Unrelated to any of this.
- maf, from wave one: the lazy Launch submenu still wants a function form for
  `SubMenuItem.subMenu` in `packages/core`; the argument-taking views are still
  in `stateModel.ts`; pan-stable `legendItems` stays reverted (no read
  expresses "a CDS is on screen").
- wiggle, from wave one: a component test for the crosshair (no wiggle
  component test exists in jsdom).

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
