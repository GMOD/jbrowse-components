---
name: mark-grammar-v5
description: The 2026-09-09 mark/grammar pass for v5 — what landed (the example plugin on the mark layer, the quantitative class from config, the declared encoding and LinearMarkDisplay, the frame plan, the legend deriving from colour scales, the pileup on the mark list, every key on the scales, the two packers on the encoder, the guides config-first, the y axis derived from a declared value scale) and the one thread still open — the browser checks nobody has run. Read before touching render-core marks, LegendMixin, ScoreScaleMixin, plugins/marks or the alignments pileup passes.
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
3. **Manhattan and the example onto the encoder — landed 2026-09-09**
   (`60c4a394fd`, `76d185b6f0`). `encodeFeatures` takes a `ChannelReader` in
   any channel's place; Manhattan hands it the colouring mode's colour and
   glyph readers and reads LD's r² over `featureIndex` after, the example is
   the bare `{ y: scoreColumn }` call with the display folding shipped `yMax`
   into one domain its shader reads through `valueScale`. Field colouring
   fills the encoder's `ScaleTable`. `MARK_ENCODING.md` §"A reader in a
   channel's place" has the measurement (13 ns/feature over the hand loop,
   28 in LD mode). What it did not do: put the r² array on the encoder as a
   generic extra channel — one consumer, and ADR-106 says an ABI option waits
   for a second pull.
4. **The guides, config first — landed 2026-09-09** (same commits). Both
   developer guides open on the `marks` entry and link the config page as
   rung one; the config page links back up the ladder. Not done: a figure of the ladder.
5. **The y axis on the chrome — landed 2026-09-09** (ADR-109). `valueScale`
   on `ScoreScaleMixin`, `ticks` derived, `ChromeYAxis` / `SvgYAxis` placed by
   the two shells, the axis primitives in `display-ui`. The single wiggle,
   Manhattan and the mark display are on it; the multi-wiggle keeps its
   per-row `ticks` with the scale unset. Not done: the alignments coverage
   band and its insert-size axis (a band inside a taller display, its own
   gutter and orientation — a `box` member on the declaration is the first
   move), and the multi-wiggle's `ScoreDomainCaption`. Tooltips stay unsized.
   Thread 6's browser list grows by the three migrated displays' axes.
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
