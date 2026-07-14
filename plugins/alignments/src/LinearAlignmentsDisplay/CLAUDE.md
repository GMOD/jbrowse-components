# LinearAlignmentsDisplay

## Settings: storage + invalidation tiers

Adding a track-menu setting? Decide two things.

**Storage:** every track-menu display option is a **config slot**. Add a slot to
`configSchema.ts`, read it with a thin
`get key() { return getConf(self, 'key') }` view, and write it with
`self.configuration.setSlot('key', value)`. This survives hide/retick (fixes
#5591 — the slot lives on the persistent track config, not the ephemeral display
node) and lets a config default be set declaratively. Don't add plain MST props
for display options anymore — the former MST-prop toggles (`linkedReads`,
`showCoverage`, `showPileup`, `readConnections`, `showSoftClipping`, the
sashimi/arc settings, …) were all promoted to slots. Reserve plain MST props /
volatiles for genuinely per-instance transient state (hover, selection, scroll).

**Blast radius:** which getter reads it decides what it invalidates. Tiers 2–4
are auto-wired by MobX; **tier 1 is manual** because the worker boundary defeats
MobX tracking.

| Tier            | Effect                              | Where to wire it                            |
| --------------- | ----------------------------------- | ------------------------------------------- |
| 1 refetch       | clears `rpcDataMap`, worker re-runs | list in `rpcProps()` **and** read in worker |
| 2 relayout      | redo main-thread Y-layout           | read in `laidOutPileupMap` getter           |
| 3 arc recompute | rebuild arcs (no refetch)           | read in `arcsByGroup` getter                |
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

`colorTagMap` is the canonical trap: it's derived from worker output, so feeding
it back through `rpcProps()` makes a discover→assign→refetch loop. It's now
tier-2 — worker reports raw `readTagValues`, main thread bakes `readTagColors`
in `laidOutPileupMap`. Keep `colorTagMap` out of `rpcProps()`.

## Read height vs track height: two axes, one crossover

The "Read height" menu drives **two orthogonal axes**, and almost every subtle
rule below is a _consequence_ of one exception. Learn the model once and the
special-cases stop being surprising.

- **Read-height axis** — how tall each read is drawn. The `featureHeight` slot:
  Normal (7) / Compact (3) / Super-compact (1) / Custom. Spacing is _derived_
  from it, never stored (`featureSpacing` = `h > 3 ? 1 : 0`).
- **Track-height axis** — how the track absorbs more content than fits. The
  `heightMode` slot (shared vocabulary with the canvas display via
  `HeightModeMixin`): `fixed` scrolls, `grow` autogrows the track (up to
  `GROW_MAX_HEIGHT`), `fit` shrinks reads to fill the current height.

**The one crossover: `fit` is the sole `heightMode` that also drives the
read-height axis.** `fixed` and `grow` both render reads at the configured
`featureHeight`; only `fit` _derives_ the size. So `fit` and the compactness
presets are mutually exclusive answers to "how tall are reads?", while `grow`
stays independent (you can autogrow at any fixed size). Everything awkward flows
from that:

- `sizeActive = heightMode !== 'fit'` (`featureSize.ts`) hides the preset
  checkmarks while fitting — no fixed size is "selected" when the size is derived.
- `setFeatureHeight` drops `fit → fixed` — a chosen size would be dormant under
  fit, so picking one exits fit to make it take effect.
- The fit cap in `fittedFeatureHeight` uses the **Normal** height, NOT
  `configuredFeatureHeight` — fit _overrides_ the compactness preset, so a
  Compact selection must not clamp the fit (else Compact would override fit).
- `isFitting = fitHeightToDisplay && fittedHeightPx > 0` gates the derived path;
  when nothing fits (no rows / no room) the getters fall back to the config.

**Naming traps in the read-height getters** (all in `model.ts`), because the
resolved value is confusingly named like the raw slot:

- `getConf(self, 'featureHeight')` is the **raw configured** slot value, but the
  `self.featureHeight` _getter_ is the **effective** (fit-squeezed) render value.
  Editors that mutate the size (the dialog) must read `configuredFeatureHeight`,
  never `featureHeight`, or they bake the squeezed height.
- `fittedHeightPx` / `fittedFeatureHeight` are **pitches** (body + spacing);
  `featureHeight` is a **body**. `featureHeight = fittedHeightPx -
  featureSpacing`. Don't conflate pitch and body.
- `fittedHeightPx` is a volatile bridged by an `afterAttach` autorun purely to
  break a MobX cycle: `fittedFeatureHeight` reads _late_ layout getters, but
  `featureHeight` is an _early_ getter the layout depends on. The volatile is the
  seam; don't try to make `featureHeight` read `fittedFeatureHeight` directly.

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

On-screen and SVG export share one builder: `renderSvg.tsx` calls
`drawAlignmentsToCtx` (wraps `buildAlignmentsRegionMap` + `drawAlignmentBlocks`)
— the same `drawAlignmentBlocks` the on-screen `Canvas2DAlignmentsRenderer`
uses, against a real canvas or an `SvgCanvas`. Everything (coverage, arcs,
pileup, mismatches, clips, modifications, connecting lines) flows through this
unified pass — don't reintroduce parallel SVG-only draw functions.

### Arc band placement (`computeArcBand`) and z-order

`computeArcBand(state)` in `rendererTypes.ts` is the single source of truth for
where the paired-end arc band lives — `{ top, height, down }` — and is
**decoupled from `showCoverage`**: up-mode arcs overlay the coverage band when
it's shown, else take their own `readConnectionsHeight` band; down-mode arcs
always sit in their own band below coverage. Both renderers and SVG draw the
band in a **single pass after the pileup** (the band never overlaps the pileup
region, so up-mode arcs still land in front of the coverage histogram, which
paints earlier). Don't reintroduce a `covH > 0` gate or a separate up/down draw
block — that re-couples arcs to coverage and resurrects the `arcTop === 0`
anchor heuristic that mis-anchored down-mode arcs when coverage was hidden.

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
