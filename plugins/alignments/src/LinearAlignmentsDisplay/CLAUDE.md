# LinearAlignmentsDisplay

## Settings: storage + invalidation tiers

Adding a track-menu setting? Decide two things.

**Storage:** prefer `ConfigOverrideMixin` (`getConfWithOverride`/`setOverride`)
for anything that's a _display option_. Adding a config default later is a
one-line schema change with no code edits, and the key appears flat in session
snapshots. Plain MST fields are the older mechanism and many settings still use
them (`linkedReads`, `showCoverage`, `pairedArcs`, …); the line is genuinely
fuzzy, so match the neighbours rather than chasing a crisp rule. New config
override keys must be added to the `configKeys` list in the
`ConfigOverrideMixin` call in `model.ts`.

**Blast radius:** which getter reads it decides what it invalidates. Tiers 2–4
are auto-wired by MobX; **tier 1 is manual** because the worker boundary defeats
MobX tracking.

| Tier            | Effect                              | Where to wire it                            |
| --------------- | ----------------------------------- | ------------------------------------------- |
| 1 refetch       | clears `rpcDataMap`, worker re-runs | list in `rpcProps()` **and** read in worker |
| 2 relayout      | redo main-thread Y-layout           | read in `laidOutPileupMap` getter           |
| 3 arc recompute | rebuild arcs (no refetch)           | read in `arcsComputed` getter               |
| 4 rerender      | redraw only                         | read in `renderState` getter                |

**Tier 4 means a full canvas repaint** — every field in `renderState` redraws
all pileup layers. So per-mousemove state must NOT be tier 4. The hover
highlight is deliberately a React overlay (`HighlightOverlay` /
`computeHighlightBoxes` / `model.highlightBoxes`), not a `renderState` field:
`featureIdUnderMouse` changes on nearly every mousemove, and routing it through
the canvas re-rasterized the whole pileup each move (catastrophic on the
Canvas2D fallback with per-base-quality — every base is a `fillRect`). Selection
(`selectedFeatureId`/`selectedChainIds`) stays in `renderState` on purpose: it
changes on click (rare) and belongs in SVG export. Don't move the hover
highlight back into `renderState`.

Gotchas: arc settings
(`drawInter`/`drawLongRange`/`arcColorByType`/`pairedArcs`) stay tier 3 — don't
add them to `rpcProps()`. Only `sortedBy.tag` flows to the worker (`sortTag`
getter), so sort-_position_ changes re-layout without refetching. Never put a
fetch-result derivative in `rpcProps()` (infinite loop — see
`agent-docs/ARCHITECTURE.md`).

`colorTagMap` is the canonical example of why: it is **derived from** worker
output (`newTagValues`) yet was once also **fed back** to the worker via
`rpcProps()` to bake per-read colors — a discover→assign→refetch loop. It is now
a tier-2 setting: the worker reports raw per-read tag values (`readTagValues`)
and the main thread bakes `readTagColors` in `laidOutPileupMap`
(`readTagColors.ts`). Keep `colorTagMap` out of `rpcProps()`.

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

### Coverage paints before up-mode arcs (z-order must match the GPU)

In `drawAlignmentBlocks` the up-mode (`!arcsDown`) paired-end arcs paint
**after** coverage so arcs sit in front of the histogram. This mirrors the
on-screen `GpuAlignmentsRenderer` pass order (coverage passes, then
`PASS_ARCS`). The two renderers' draw order must stay in sync; swapping them
puts arcs behind coverage in SVG export only — a path-specific regression that's
invisible on screen. Down-mode arcs draw in their own band below coverage and
are unaffected.

### Two distinct "arc" concepts — keep them apart

- **Paired-end coverage arcs** (`features/arcs`, `drawArcs`, `arcsRpcDataMap`)
  draw in the coverage band and flow through the unified canvas pass, so they
  serialize straight into `SvgCanvas` on export. Non-interactive.
- **Linked-read bezier arcs** (`PileupBezierOverlay`, `computePileupBezierArcs`,
  gated on the `showBezierConnections` flag) span the pileup and are an
  interactive React SVG overlay (hover tooltip + click-to-select), like sashimi
  below. `showBezierConnections` is orthogonal to `linkedReads` layout — the
  curves draw over an ordinary pileup or a chain layout. Toggling it is a
  main-thread tier-2/4 setting (`laidOutPileupMap` + `renderState`), never in
  `rpcProps`. The horizontal-tangent oval shape mirrors BreakpointSplitView's
  `AlignmentConnections`.

The overlay was renamed from `PileupArcsOverlay` precisely so "Arcs" reads as
the coverage-band feature and "Bezier" as the linked-read overlay. Don't route
paired-end coverage arcs through the overlay, and don't port the bezier overlay
into `drawAlignmentBlocks`.

### Sashimi + bezier overlays are intentionally SVG — but the math is shared

Sashimi (`SashimiArcsOverlay.tsx` / `computeSashimiArcs`) and linked-read bezier
(`PileupBezierOverlay.tsx` / `computePileupBezierArcsFromModel`) are vector SVG
on both the on-screen and export paths. Each shares one geometry function
between the live overlay and `renderSvg.tsx`, so the two paths cannot drift in
curve shape, color, or stroke width. Don't add a second draw path; if the arcs
need to change, change the shared compute.

The "vector by design" choice is about the rendering medium (low arc count +
native SVG hover/click behavior the rasterized pipeline can't match), not the
math — do not "port these overlays into `drawAlignmentBlocks`."
