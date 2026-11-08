---
name: wiggle-grammar-and-cleanup
description: "What remains of the 2026-11-07 plugins/wiggle analysis: cleanups, sharing with sibling displays, and the calls (plot type as IR, layer + stat) waiting on Colin. Read before fixing a wiggle bug or proposing layers, transforms or facets on it."
---

# plugins/wiggle: grammar and cleanup

- **In:** a ranked findings list over `plugins/wiggle` and a grammar
  direction, each checked against the ADRs and parked ideas. Its verified
  bugs landed on 2026-11-08 (the score matrix's adapter options, the plot
  type typed `WiggleRendering`). The multi-wiggle `getSources` fallback is
  not dead: jbrowse-plugin-zarr's `MultiWiggleZarrAdapter` lists through it,
  pinned in `executeRenderMultiWiggleData.test.ts`.
- **Out:** the cleanups below landed or declined, and layer + stat put to a
  review or filed under `ideas/`.

Shares its convergence pattern with
[alignments-analysis-2026-11](alignments-analysis-2026-11.md): a key or
palette built by hand where core has one. Claim a step here before starting
it.

## Declined on 2026-11-08

- **±Infinity in the array path.** No common producer writes one: C, Python
  and R print `inf`, which BedGraph's `+value` reads as NaN and drops, and
  MACS2, ENCODE and deeptools defaults stay finite. The draw clamps it to the
  top and autoscale skips it; only clustering would fail, loudly, in hclust.
  If a trigger appears, `Number.isFinite` in `addValues` alone is the fix
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
- **Filling a threshold's unwritten bands from core's `thresholdPalette`.**
  Colin, 2026-11-08, shown the two rules side by side
  (https://claude.ai/artifact/5yshDLfRzA35JytnvfCxE3): "dont want to use
  viridis by default for wiggle stuff". Wiggle keeps its red/grey/blue
  diverging default for a threshold with fewer `range` colors than bands
  (`resolveWiggleColor`), though the other displays fill from viridis.
- **The right-click label "drift" against plugins/marks.** Each display names
  its own measure (MAF "by identity", variants "by genotype"), so "by score"
  and "by value" both stand.

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

- **Canvas2D fill choice is written three times.** `drawXYPlot`,
  `drawDensity` and `drawScatter` each choose ramp vs per-instance ABGR vs
  flat. `rampAsBands` and `drawMinMaxBand` each scan low/high
  (`shared/wiggleDrawFunctions.ts`).
- **Casts that stay, each for a reason:** `regionPayloads as` (the display
  mixin hands payloads back as `unknown`, and every display narrows them so);
  `conf as Instance<…>` (`configProblemsOf` takes an untyped draft);
  `as AdapterConfig[]` (`subadapters` is a `frozen` slot). `as
  BaseFeatureDataAdapter` in `MultiWiggleAdapter.ts` can go through
  `isFeatureAdapter`, as maf's does, once the ~38 mocks in its test stub
  `getFeatures`.

## Sharing with sibling displays

- **The view chain is restated.** `shared/wiggleStaticHost.ts` repeats the
  model's roughly 20 wiggle view layers in order. Tree-sidebar's row steps are
  listed four times: `TreeSidebarMixin`, the wiggle and mark static hosts, and
  `plugins/variants/src/tables.ts`. The fix is one installer each. Try it for
  TS7056 first; the model's inline views (`liveNotices`, `rpcProps`,
  `autoClusterReady`, `hasResolution`) have to move out. It fits
  `ideas/waiting-on-a-number/a-displays-render-inputs-run-on-a-plain-host.md`.
- **Small duplicates:**
  - `DEFAULT_LINE_WIDTH_PX` repeats plugins/marks `markVocabulary.ts`
    (`LINE_INTERPOLATIONS` is a subset of marks' `MARK_INTERPOLATIONS`, not
    a copy).
  - `WiggleSize` is a subset of `MarkSize`.
  - A point's unset size is 2 px here (`DEFAULT_POINT_SIZE_PX`) and 4 px there
    (`DEFAULT_POINT_DIAMETER_PX`), and nothing says why.
  - The source-listing fallback repeats variants' `sourcesAndWarnings`
    (`MultiSampleVariantGetSources.ts`); one shared helper serves both.

## Grammar direction

- **The plot type keeps one name per shader**, declined at `renderingOf`
  (`renderingTypes.ts`); reconsider with ADR-227's conditions.
- **Layer + stat** is filed as
  `ideas/waiting-on-a-call/a-wiggle-layer-earns-its-place-with-a-window-stat.md`.
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
