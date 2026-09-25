---
name: mark
description: Report from the mark row-model round: fixes for review findings 1–7 (wiggle shorthand move, shared binColumns, MarkGetRowSources RPC), what a mark display over a multi-BigWig draws, and where the code disagreed with the brief.
---

>Please read agent-docs/ideas/ready/one-row-model-for-displays-that-stack-by-a-key.md agent-docs/handoffs/row-model-colour-and-mark-rows.md and continue work, you can look at progress from last agent in .jsonl lines from ~/.claude2/ and can work in their worktree if it helps


Fixes
- Finding 1, which also covers 3 and 5 (617cb192b2): in displayDefaults.ts, refuseFacetShorthand became wiggleEntryShorthand. It runs after seeding and moves displayDefaults.facet and .rows onto the wiggle display's entry only ({ ...moved, ...d }, so an entry's own value wins).
  - The Plot field default is setFacetField(fields.facet) again; plotFields.ts is back to main's, and the unused mark setRowsField is gone.
  - Pins are in displayDefaults.test.ts and a new quantitativeTrackRows.test.ts, which loads both plugins. Breaking the move fails 4 tests.
  - ADR-157's mark paragraph now says what you asked, including that one row per source is your call. I also reverted the branch's ADR-126 edit.
- Finding 2 (5fc1606320): new packages/tree-sidebar/src/binColumns.ts (columnSegments, binSpan, columnMeans) with the wiggle rule copied exactly.
  - Wiggle's getScoreMatrix now calls it: its 10 tests pass unchanged, and breaking the sub-column floor fails 4 of them.
  - collectMarkRowMatrix feeds the encoded lanes in through a per-row offset table. buildMarkRowMatrix is deleted.
  - Pins: the 4–6 bar now bins to [0,1,0,0], and a 1 bp CpG-like fixture clusters into its two groups.
- Finding 4 (c51c5deccb): a new MarkGetRowSources RPC runs once per adapter config, through installPrerequisiteFetch with no status messages, only while rows are on source.
  - It answers only for multi-source adapters, detected by getMultiSourceFeatureArraysMulti; any other adapter returns [] without scanning its features.
  - discoveredRows unions the adapter's list (label, and colour as labelColor) with the sources found in the features.
  - Pinned: a window where one source is empty keeps the same discoveredRows object and the tree. The work census's initial load gains MarkRowSources 1.
- Findings 6 and 7 (`c51c5deccb`, `f6ea6addd8`):
  - Tests added: a new value arriving in a region, the sort-at-column checked against the picture, and collectMarkRowMatrix / MarkGetRowSources tests.
  - The tooltip reads sources[row].label.
  - rowLabelOffset moved to wiggle-core, with a test, and both displays call it.
  - tree-sidebar/CLAUDE.md and CLUSTERING_WORKFLOW.md updated.

What a mark display over a multi-BigWig draws
- By default: main's picture, all sources overlaid in one band, or facet: 'source' chip sectionsonce the Plot field default applies.
- With an explicit rows: 'source': one labelled row per file, and every listed file keeps its row.

Gates
- Facet snapshots: rowDerivation facet snapshots are byte-identical to the first pin (09c552d229).
- Jest (marks, wiggle, tree-sidebar, wiggle-core): 140 suites, 2244 passed, 2 skipped.
- Typecheck and pnpm verify: green.
- pnpm verify --full: ESM build green; the sv-inspector and HighlightRegion errors are fixed onmain. One docs check is red from main: packages/display-kit/CLAUDE.md:155 names ManhattanHitIndexes, which main's ac93c440a2 removed. I left it unfixed.
- pnpm test-related: it ran every suite outside jbrowse-web because the lockfile changed. One failure, a 20 s timeout in AddConnectionWidget.test.tsx under load average ~80; it passes 4/4 when run alone.
- Browser, --filter=mark: 11/11, twice. The lock has no mark goldens, so the comparison was againstthe previous agent's local captures. By eye, marks_multi_rows draws chip sections and marks_rows draws labelled k1–k4 rows.
- RowArrangementUndo.test.tsx: 5/5.

Where the code disagreed with the brief
- Base: the branch sat on 5fb2af80ad, which already contained main's three mark commits, not ondc9adf0665. Main's cc97244dce corrects the handoff to match.
- waitReady: main's bc2175a8d5 took the rows-cut line out of notices, so it never fed waitReady, and 824478a9f2 later removed the chip.
- The scene: marks_multi_rows is main's facet scene. The branch's rows scene is marks_rows, and italready writes rows: "source" explicitly.
- Main's routing: main also adds a mark display entry to every multi-quantitative track, carryingonly height: 200. I left that alone.
- Finding 3's regression: before the fix, a non-source displayDefaults.rows wasn't failing the load. It went silently to the mark display, per the reviewer's probe.
- facet.ts ~102: I kept the field label in rowsLayout because the layout is what decides whenregions get re-offset for upload, so a relabel re-offsets nothing. The tooltip reads the row's label instead.
