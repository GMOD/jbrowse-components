# LinearAlignmentsDisplay

## Settings: storage + invalidation tiers

Adding a track-menu setting? Decide two things.

**Storage:** prefer `configOverrides` (`ConfigOverrideMixin`) for anything
that's a _display option_. Read with `getConfWithOverride` if it already has a
config-schema default, or `getOverride` if not — either way, adding a config
default later is a one-line schema change with no code edits, so the override
map is the future-proof home. Plain MST fields are the older mechanism and many
settings still use them (`linkedReads`, `showCoverage`, `pairedArcs`, …); the
override-vs-field line is genuinely fuzzy, so match the neighbours rather than
chasing a crisp rule.

**Blast radius:** which getter reads it decides what it invalidates. Tiers 2–4
are auto-wired by MobX; **tier 1 is manual** because the worker boundary defeats
MobX tracking.

| Tier            | Effect                              | Where to wire it                            |
| --------------- | ----------------------------------- | ------------------------------------------- |
| 1 refetch       | clears `rpcDataMap`, worker re-runs | list in `rpcProps()` **and** read in worker |
| 2 relayout      | redo main-thread Y-layout           | read in `laidOutPileupMap` getter           |
| 3 arc recompute | rebuild arcs (no refetch)           | read in `arcsComputed` getter               |
| 4 rerender      | redraw only                         | read in `renderState` getter                |

Gotchas: arc settings
(`drawInter`/`drawLongRange`/`arcColorByType`/`pairedArcs`) stay tier 3 — don't
add them to `rpcProps()`. Only `sortedBy.tag` flows to the worker (`sortTag`
getter), so sort-_position_ changes re-layout without refetching. Never put a
fetch-result derivative in `rpcProps()` (infinite loop — see
`agent-docs/ARCHITECTURE.md`).

## Layout architecture

Pileup and chain layout are computed on the **main thread**, not in the RPC
worker. Required because consistent Y-row assignment across multiple
`displayedRegions` is impossible per-region — each worker sees only one region,
so mates spanning region boundaries can't be placed on the same row.

Layout flows through the `laidOutPileupMap` getter. Raw fetched data lives in
`rpcDataMap` with zero-filled Y arrays; the getter returns shallow clones with
filled Y arrays, `maxY`, and (chain mode) connecting-line / Flatbush data. MobX
caches this — recomputes only when `rpcDataMap`, `sortedBy`, `showSoftClipping`,
or `renderingMode` change. Raw entries are never mutated.

### `placeRect` invariant

Both pileup (`sortLayout.ts`) and chain (`computeChainLayout.ts`) use
`placeRect(rows, start, end)`. Each row is a sorted `[s1,e1,s2,e2,...]` flat
list; placement is first-fit with gap-filling. **Do not reintroduce a
levels/right-edge-only array** — features arrive out of start order in both
chain layout (sorted by distance) and pileup sort-by-base/strand, so
right-edge-only would fragment layout. Start-sorted input hits an O(1) fast-path
that matches end-array performance in the common case.

### Worker contract

`executeRenderAlignmentData.ts` (chain branch) returns chain metadata arrays and
all Y arrays initialized to 0. The main thread fills real Y values and builds
connecting lines / Flatbush.

## SVG export pipeline

`renderSvg.tsx` makes a single call to the pure
`drawAlignmentsToCtx(ctx, { laidOutPileupMap, arcsRpcDataMap }, blocks, state)`
— that wraps `buildAlignmentsRegionMap` + `drawAlignmentBlocks`, the latter
being the same draw entry point the on-screen
`Canvas2DAlignmentsRenderer.renderBlocks` uses. The context is a real canvas
(when `opts.rasterizeLayers`) or an `SvgCanvas` (vector). No headless renderer
instance — the on-screen `Canvas2DAlignmentsRenderer.sync(sources)` calls the
same `buildAlignmentsRegionMap` directly, so on-screen and export literally
share the builder. Coverage, indicators, paired arcs, pileup reads, mismatches,
soft/hard clips, modifications, and connecting lines all flow through the
unified pass — do not reintroduce parallel SVG-only draw functions.

### Sashimi is intentionally SVG-only — but the math is shared

Sashimi arcs are vector SVG on both paths. `SashimiArcsOverlay.tsx` (on-screen,
with hover/click) and `renderSvg.tsx` both consume
`computeSashimiArcs(opts) → SashimiArc[]` from `components/sashimiArcs.ts` —
same geometry (cubic Bezier), same color (`getArcColor(strand)`), same stroke
widths. Don't add a new sashimi draw path; if the arcs need to change, change
`computeSashimiArcs`.

The "vector by design" choice is about the rendering medium (low arc count

- native SVG hover behavior the rasterized pipeline can't match), not the math —
  do not "port sashimi into `drawAlignmentBlocks`."
