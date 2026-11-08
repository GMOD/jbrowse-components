---
name: wiggle-grammar-and-cleanup
description: "What remains of the 2026-11-07 plugins/wiggle analysis after its bug batch landed on 2026-11-08: cleanups, sharing with sibling displays, and the grammar calls (plot type as IR, layer + stat) still waiting on Colin. Read before fixing a wiggle bug, respelling its color or plot type, or proposing layers, transforms or facets on the quantitative display."
---

# plugins/wiggle: grammar and cleanup

- **In:** a ranked findings list over `plugins/wiggle` and a grammar
  direction, each checked against the ADRs and parked ideas. Its verified
  bugs and dead code landed on 2026-11-08 (the score matrix's adapter
  options, the plot type typed `WiggleRendering`, the multi-wiggle
  `getSources` fallback).
- **Out:** the cleanups below landed or declined, and layer + stat put to a
  review or filed under `ideas/`.

Shares its convergence pattern with
[alignments-analysis-2026-11](alignments-analysis-2026-11.md): a key or
palette built by hand where core has one. Claim a step here before starting
it.

## Declined on 2026-11-08

- **±Infinity in the array path.** No producer is known to write one, and
  dropping it would hide a p = 0 peak that the GPU now clamps to the top
  (memory `trust-the-data-dont-build-malformed-checks`).
- **The BedGraph export on a numeric `source`.** Every adapter yields a
  string: BedGraph splits its columns and the render path keys groups by
  `${source}`.
- **The `MultiWiggleAdapter.getFeatures` inner subscription.** It leaks only on
  an unsubscribe without an abort, and no consumer does that: an RPC cancel
  aborts the signal, which errors each inner fetch. The multi-pairwise
  synteny adapter has the same shape. A real fix would teach
  `ObservableCreate` to keep a teardown an async body hands back.
- **`listRowSources` dropping `group`.** That is core's `ListedRowSource`
  contract, not a wiggle bug. Filed as a gap in
  `ideas/waiting-on-a-call/row-attributes-have-one-home.md`.
- **The right-click label "drift" against plugins/marks.** Each display names
  its own measure (MAF "by identity", variants "by genotype"), so "by score"
  and "by value" both stand.
- **Filling a missing threshold band from the default ramp** (recommended
  decline, Colin's to confirm). Wiggle's default is a diverging pair, and a
  grey neutral middle is that pair's idiom, documented in
  `wiggleColorConfigSchema.ts`. The key already takes its colors from the
  painted `wiggleColor`, so key and paint agree.

## Unverified

Only the adapter-review subagent traced these.

- **A failing subtrack leaves its siblings downloading.** `eachSource` gives
  the members no shared AbortController, and `mapWithConcurrency` only stops
  starting new members. The blanking itself is already an accepted loose edge
  in `ideas/waiting-on-a-call/multi-file-tracks-take-their-rows-from-their-members.md`.
- **`binRawRegion`'s overflow branch is dead** (the `-1` from `emit` and its
  two raw fallbacks in `BigWigAdapter/syntheticTiers.ts`). This was worked by
  hand, not tested.
- **A feature missing its `y` field plots as 0** (`featuresToRaw`,
  `Number(read(f) ?? 0)`), where the matrix writes NaN for "no record". It
  may be intended.

## Cleanups

- **`scaleType`, `summaryField` and `extent` are typed `string`** in about 25
  signatures across wiggle, wiggle-core (`autoscale.ts`, `scale.ts`,
  `computeYTicks.ts`) and marks (`markAutoscale.ts`). `SummaryField` and
  `Extent` exist; `scaleType` has no union yet. Same pass as the plot type
  (memory `teach-bug-classes-through-the-type-system`).
- **Canvas2D fill choice is written three times.** `drawXYPlot`,
  `drawDensity` and `drawScatter` each choose ramp vs per-instance ABGR vs
  flat. `rampAsBands` and `drawMinMaxBand` each scan low/high
  (`shared/wiggleDrawFunctions.ts`).
- **`RawFeatureArrays` min/max are separately optional, but every producer
  sets both.** A `summary?: { minScores, maxScores }` field drops the pair
  checks.
- **Casts:** `LinearWiggleDisplay/model.ts` (`regionPayloads as`,
  `conf as Instance<…>`), `wiggleColor.ts` (`as ColorSetting`) and
  `MultiWiggleAdapter.ts` (`as AdapterConfig[]`, `as BaseFeatureDataAdapter`).

## Sharing with sibling displays

- **The view chain is restated.** `shared/wiggleStaticHost.ts` repeats the
  model's roughly 20 wiggle view layers in order. Tree-sidebar's row steps are
  listed four times: `TreeSidebarMixin`, the wiggle and mark static hosts, and
  `plugins/variants/src/tables.ts`. The fix is one installer each. Try it for
  TS7056 first; the model's inline views (`liveNotices`, `rpcProps`,
  `autoClusterReady`, `hasResolution`) have to move out. It fits
  `ideas/waiting-on-a-number/a-displays-render-inputs-run-on-a-plain-host.md`.
- **Small duplicates:**
  - `LINE_INTERPOLATIONS` and `DEFAULT_LINE_WIDTH_PX` repeat
    plugins/marks `markVocabulary.ts`.
  - `WiggleSize` is a subset of `MarkSize`.
  - A point's unset size is 2 px here (`DEFAULT_POINT_SIZE_PX`) and 4 px there
    (`DEFAULT_POINT_DIAMETER_PX`), and nothing says why.
  - The source-listing fallback repeats variants' `MultiSampleVariantGetSources`.

## Grammar direction

- **The plot type moves to `(mark, interpolate)` throughout**, with the shader
  int made only at the uniform write. `WiggleRendering` stays only for v4
  lifts and the menu/spec-recipe table. The typing landed; this respelling
  moves `website/src/lib/spec-recipe/fields.ts` (`plotTypeStep`), which
  imports `WIGGLE_PLOTS`. Colin's call.
- **Layer + stat is one design question, not two.** Layering alone (`extent`
  as an `errorband`, bar + line) earns little without a stat. With a `window`
  stat it tells a story: raw bars under a smoothed trend. Its obstacles:
  - The nesting order flips at the origin: the positive side paints max→min,
    the negative side min→max (`stackSides` in `shared/wiggleLayers.ts`). A
    plain layer list cannot say that, which is ADR-227's own objection.
  - `wiggleParams` reads the plot type off `sources[0]`, so a region holds one
    type (`shared/wiggleMarks.ts`).
  - Transforms run in `featureTransforms`, which the BigWig array fast path
    bypasses. ADR-152 keeps wiggle off the column encoder. `data.resolution`
    is points per pixel, not a bin width (ADR-238 kept it).
  - It reopens ADR-216's rejected `marks[]` alternative at the spelling level.

  Recommended: file to `ideas/` rather than review now. If reviewed, use real
  tracks (phyloP, a CNV cohort, bedMethyl). Memories:
  `grammar-over-a-maze-of-booleans`, `a-new-dimension-should-refine-an-existing-one`.
- **Facet by `group` with sources overlaid in a row.** Gated on row
  attributes (`ideas/waiting-on-a-call/row-attributes-have-one-home.md`,
  ADR-143). Not a wiggle change.
- **Already declined, don't re-propose:**
  - a free y per row (ADR-141, GRAMMAR_OF_GRAPHICS.md)
  - stack and area (ADR-184)
  - size mapped from a field (ADR-216)
  - render-core marks as the renderer (ADR-227)
  - more color scale types (ADR-251)
  - `numRows` vs `rowCount` (parked in `one-spelling-for-the-drawn-row-count`)
- **The one place the grammar is knowingly bent** is ADR-251: a subtrack with
  no color falls back to the score's pair, two fields in one channel. It is
  accepted. Note it; don't relitigate it.

## Open calls for Colin

- **Confirm the threshold-palette decline** above.
- **Spec-as-IR for the plot type**, including the `website/` spec-recipe
  consumer?
- **Layer + stat: file to `ideas/`** (recommended), or a review now?
