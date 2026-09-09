---
name: mark-grammar-v5
description: The 2026-09-09 mark/grammar pass for v5 — what landed (the example plugin on the mark layer, the quantitative class from config, the declared encoding and LinearMarkDisplay, the frame plan, the legend deriving from colour scales, the pileup on the mark list, every key on the scales) and the four threads still open, each with its first move — Manhattan and the example onto the encoder, the guides made config-first, the y axis on the chrome, and two checks nobody has run in a browser. Read before touching render-core marks, LegendMixin, plugins/marks or the alignments pileup passes.
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

1. **The pileup onto render-core marks — landed 2026-09-09** (the commit
   beside this edit). `PILEUP_MARKS` over `features/pileupShape.ts`, both
   renderers on `planMarks`, `hitTestCigarItem` asking the marks with the
   section's `RenderState`; every parity suite green, `pnpm test-related
   --with-web` 676 suites green. What it did not do: run
   `sweepDrawAgainstHit` over the pileup shapes — the sweep wants `{ count }`
   channels and pixel-box containment, and `pileupShape`'s `hitNearest` is
   bp-containment (a widened sub-pixel span answers inside its bp, not its
   1px rect), so the per-feature `markParity` suites stay the one-directional
   gate. A sweep variant taking a containment rule is the first move if one
   is wanted.
2. **Legend pass two — landed 2026-09-09** (ADR-108 §Consequences has the
   record). gwas, both wiggles, alignments and the synteny family are on
   `colorScales`; the synteny views host `ChromeLegend` / `SvgLegend` off
   `TrackColorsMixin`'s own legend-host members, which is the view-level
   answer. Not run in a browser: the multi-wiggle's caption-plus-key stack
   and the Hi-C key under its resolution box both moved onto `legendTop`,
   and the two synteny browser suites now target `floating-legend` — thread
   6's list grows by those.
3. **Manhattan and the example onto the encoder** (ADR-107 §Consequences).
   `buildManhattanResult` = `encodeFeatures(features, { y: scoreField, color,
   glyph })` plus the LD `r2` array and `indexFound`; `buildScoreResult` =
   `encodeFeatures(features, { y: scoreColumn })` with the display owning the
   domain. Then `manhattanMarks.ts` is a rename and `ScoreRPC/` shrinks to the
   call. Sized on 2026-09-09: the example's `buildScoreResult` normalises
   `scores` to the region's own max in the worker, and its shape reads that
   0..1 value straight into the bar height, so "the display owning the
   domain" means the example's `score.slang` takes a y domain uniform
   (`valueScale.slang`, as `bar` does) and `LinearScoreDisplay` grows the
   autoscale the wiggle family has. The developer guide is generated from
   those files (`#exampleFile`), so thread 4 moves with it — do the two as
   one branch.
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
   `DisplayChrome` and `renderDisplaySvg`, removes eight placement sites, and
   the multi-wiggle's `ScoreDomainCaption` (the `[min, max]` an axis-less
   row shows) is the ninth — it is what the axis becomes when there is no
   room for one, and it is why that display answers `legendTop`. Tooltips are
   the same shape in principle but hover content varies far more (feature rows,
   coverage tables, LD values); not sized.
6. **Two checks nobody has run in a browser.** The `bar` shader has MockHal
   uniform tests and jsdom Canvas2D paints only — no GPU capture, and the
   cross-backend gate (`browser-tests/compare-backends.ts`) was not run for it
   or for the frame plan. The chrome-placed legend moved pixels in three export
   snapshots that were re-recorded on jsdom; a real-browser look at a
   multi-row, HiC and variants export is owed before release.

## Records this pass left stale on purpose

- `reference/SESSION_SPEC_FORMAT.md` §"The assessment" still lists "Marks as a
  published unit. Run and reversed" and "A uniform `encoding` block" as
  declined; both now point at ADR-106 and ADR-107 for the class they were
  reopened for. The general reader-level grammar stays declined.
