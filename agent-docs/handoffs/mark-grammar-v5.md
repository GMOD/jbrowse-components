---
name: mark-grammar-v5
description: The 2026-09-09 mark/grammar pass for v5 — what landed (the example plugin on the mark layer, the quantitative class from config, the declared encoding and LinearMarkDisplay, the frame plan, the legend deriving from colour scales) and the six threads still open, each with its first move — the pileup conversion parked on wip/pileup-marks-conversion, legend pass two over gwas/wiggle/alignments/synteny, Manhattan and the example onto the encoder, the guides made config-first, the y axis on the chrome, and two checks nobody has run in a browser. Read before touching render-core marks, LegendMixin, plugins/marks or the alignments pileup passes.
---

# Mark grammar for v5

**TL;DR:** ADR-106, ADR-107 and ADR-108 hold the decisions; this file holds what
is still moving. Five agent branches landed on main on 2026-09-09 in this
order: the example plugin and the four developer guides onto the mark layer
(`9e9beef55f`..`a97345d587`); Manhattan on `FeatureTrack`, `scoreField`,
`colorBy: 'field'` (`c25a5c8206`..`4811c94a63`); `planMarks` and the pileup
bench (`7779271823`..`561eed3ae7`); the `bar` shape, `CoreEncodeFeatures` and
`LinearMarkDisplay` (`612606a690`..`4b07f9159f`); `colorScales` and the chrome-
placed legend (`aeddf8f957`..the merge that lands beside this file). The
manuscript's grammar position is now a four-rung ladder with three rungs
adopted (ADR-106 §"The ladder").

## Open threads, first move each

1. **The pileup onto render-core marks.** Mechanism landed and measured
   (plan walk 0.46x of today's loop). The conversion is on the branch
   `wip/pileup-marks-conversion` (`c49e3b5d57`): production code typechecks,
   four feature suites green, ~15 test files still reference removed
   signatures. First move: `git worktree add .claude/worktrees/pileup-marks
   wip/pileup-marks-conversion`, rebase onto main (render-core marks moved
   under it: `enabled`, `planMarks`, `barMark`), then work the test list at the
   top of `ideas/one-mark-declaration-per-feature.md` §"Status, 2026-09-09".
   Oracle: every parity suite there, unchanged. Do not land it red.
2. **Legend pass two** (ADR-108 §Consequences). gwas: Manhattan's `legend`
   getter becomes `colorScales` (LD bins, field categories) and
   `ManhattanLegend` / `SvgManhattanLegend` go. Wiggle: `ScoreLegend.tsx` and
   the multi-wiggle `legendItems.ts` become scales. Alignments:
   `shared/legendUtils.ts` becomes `colorScales` and `PileupComponent` /
   `renderSvg.tsx` stop placing it — do this with or after thread 1, not
   before, since both touch `PileupComponent`. Synteny-core's
   `TrackColorsMixin` / `ColorByLegend` / `SVGColorByLegend` with the dotplot
   and linear synteny views' legends, which are view-level and need the chrome
   equivalent for a view. Each migration: delete the component, its SVG twin
   and two placement sites; the export snapshot moves by the legend group's
   test id (`color-legend`) and nesting, nothing else — check with an
   element-level diff before `-u`.
3. **Manhattan and the example onto the encoder** (ADR-107 §Consequences).
   `buildManhattanResult` = `encodeFeatures(features, { y: scoreField, color,
   glyph })` plus the LD `r2` array and `indexFound`; `buildScoreResult` =
   `encodeFeatures(features, { y: scoreColumn })` with the display owning the
   domain. Then `manhattanMarks.ts` is a rename and `ScoreRPC/` shrinks to the
   call.
4. **The guides, config first.** `creating_gpu_display.md` and
   `plotting_features.md` teach the mark form (landed); neither yet opens with
   "a `marks` entry in config over any feature adapter" and sends the reader
   down to a shape only when the library lacks one. `website/docs/config_guides/`
   has the mark display's page (landed with C); the developer guides should
   link it as rung one. ADR-107's ladder paragraph is the outline.
5. **The y axis on the chrome**, the legend's pattern again: four displays
   place `YScaleBarOverlay` by hand on screen and in SVG (gwas, both wiggles,
   the alignments coverage band; `LinearMarkDisplay` copied Manhattan's). A
   `yAxis` hook on `ScoreScaleMixin` or `WiggleScoreConfigMixin`, placed by
   `DisplayChrome` and `renderDisplaySvg`, removes eight placement sites. Size
   it after thread 2 so the chrome's slot layout is settled once. Tooltips are
   the same shape in principle but hover content varies far more (feature rows,
   coverage tables, LD values); not sized.
6. **Two checks nobody has run in a browser.** The `bar` shader has MockHal
   uniform tests and jsdom Canvas2D paints only — no GPU capture, and the
   cross-backend gate (`browser-tests/compare-backends.ts`) was not run for it
   or for the frame plan. The chrome-placed legend moved pixels in three export
   snapshots that were re-recorded on jsdom; a real-browser look at a
   multi-row, HiC and variants export is owed before release.

## Records this pass left stale on purpose

- `ideas/one-mark-declaration-per-feature.md` is now a record with one open
  item (thread 1); move it to `reference/` or delete it when that lands.
- `reference/SESSION_SPEC_FORMAT.md` §"The assessment" still lists "Marks as a
  published unit. Run and reversed" and "A uniform `encoding` block" as
  declined; both now point at ADR-106 and ADR-107 for the class they were
  reopened for. The general reader-level grammar stays declined.
- `PLUGIN_ABI_STABILITY.md` says `defineMark`'s option set is third-party ABI
  (landed with the example); `enabled`, `planMarks` and `barMark` joined that
  set the same day and are not yet listed there.
