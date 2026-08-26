---
name: multiway-gpu-backend
description: MultiWaySyntenyDisplay is moving from React+SVG to the GPU→WebGL→Canvas2D render path. The model half landed 2026-08-26 — lane frames are settle-time decisions with incumbents, and a pan is one translate — so the display already draws under the data × view-transform contract a backend needs. What is left is the backend itself, and this file says which existing stack draws the ribbons unchanged, what the gene lanes need that nothing draws yet, and the order to take it.
---

# Multi-way synteny on the GPU: what is left

**Landed** (`feat(multiway synteny): a lane's frame is a settled decision, and
a pan is a translate`): `laneDecision.ts` decides each lane once per settled
block set, carrying the previous decision in, and `rowFrames` derives the frame
from `{refName, flipped, rung, pivotAnchor, pivotLaneBp}` against the live
view. The SVG stack is laid out against `renderOriginPx` and translated by
`dragOffsetPx`. Numbers, before and after, are in
[multiway-synteny-lgv-track.md](../ideas/multiway-synteny-lgv-track.md)
§"Every per-settle choice holds"; the instruments are
`plugins/linear-comparative-view/benches/multiwayLaneStability.probe.ts`
(rewrites `agent-docs/measurements/multiway-lane-stability.json`) and
`website/scripts/multiway-drag.probe.ts` (needs a `pnpm --filter @jbrowse/web
build` of the tree it measures).

**Why the backend is still worth doing, measured**: a zoom step re-renders
every SVG element at 35 ms of React per wheel tick on the tutorial's six-lane
session, and the E. coli all-vs-all links scale past it. The drag is no longer
the reason — 2.0 ms of React per frame at 60 fps.

## The ribbons are the pairwise synteny stack, per adjacent lane pair

`GpuSyntenyRenderer` / `Canvas2DSyntenyRenderer` already draw exactly this
shape: a keyed upload per track, and per track a `SyntenyTrackRenderParams`
with its own `yTop`/`height` band and its own two axes as `(offsetPx,
bpPerPx)` pairs (`syntenyRenderingBackendTypes.ts`). The shader projects each
corner as `bp * bpPerPxInv + panPx` per axis (`computeCorners` in
`shaders/syntenyTypes.slang`). A lane frame IS one such affine, so:

- one upload key per adjacent lane pair (`${upper}|${lower}`), holding a
  `SyntenyInstanceData` (`LinearSyntenyRPC/buildSyntenyGeometry.ts`) built on
  the main thread from `laneStack` — the group placements for the anchor pair
  and every gene-level pair, the `laneLinks` records for an alignment-level
  source (`Ribbons.tsx` shows which draws where);
- per pair, `yTop` = the upper lane's glyph bottom, `height` = the gutter,
  axis 0 = the upper lane's frame, axis 1 = the lower's, both expressed in the
  `renderOriginPx` space the model already lays out in, with `dragOffsetPx`
  folded into `panPx` per frame the way the synteny view folds its own
  `offsetPx`. A flipped lane is a negative `bpPerPxInv`; `isCulled` takes the
  min/max of the four corners, so it survives the reversal — check
  `ribbonEdges`/`fillEdges` do too before relying on it.
- `syntenyPickEngine.ts` gives hover, click and the tooltip's feature for free;
  the group highlight across lanes (`GroupHighlight`) is a render parameter
  like `hoveredFeatureId` is today.

Read `LinearSyntenyDisplay/AGENTS.md` first — the four passes, the pick
context rule, the `// SYNC:` pairs — and
[SHARED_CANVAS_VIEWS.md](../reference/SHARED_CANVAS_VIEWS.md) for the keyed
upload and the empty-frame rule, since several pairs share one canvas.

## The lanes need a renderer nothing has yet

Gene glyphs (merged CDS, thin UTR, intron chevrons, arrowhead — `geneGlyph.ts`
is the interval math, kept), the placement boxes, and the hover outline. Two
routes, and the canvas plugin is where both start:
`plugins/canvas/src/LinearBasicDisplay/components/GpuCanvasFeatureRenderer.ts`
and `Canvas2DFeatureRenderer.ts` draw this glyph for the feature track, in
reference px. The multiway lane is the same glyph under a lane's affine, so
the question is whether those renderers can take an axis per lane (as the
synteny stack does) or whether the lane geometry is packed to px on the main
thread and drawn as flat rects. Bands, ticks and headers are chrome and can
stay JSX over the canvas, the way `HicOverlayPanel` sits over hic's.

## The composition

`MultiWaySyntenyDisplay` composes `GlobalFetchMixin`, which already brings
`RenderLifecycleMixin`; `plugins/hic/src/LinearHicDisplay/model.ts` is the
worked example of a global-fetch display driving a backend:
`startRenderingBackend` → `installUpload`, a resolved `renderState` getter,
`DisplayChrome` instead of `DisplayStatusChrome` in the component, and a
backend factory picking GPU or Canvas2D per
[GPU_RENDERING.md](../reference/GPU_RENDERING.md). `renderMultiWaySvg` keeps
rendering the JSX stack for export until the paint-layer route replaces it —
[SVG_EXPORT.md](../reference/SVG_EXPORT.md). Cross-backend parity
([CROSS_BACKEND_GATE.md](../reference/CROSS_BACKEND_GATE.md)) is part of done.

## Order

1. Ribbons on the synteny stack behind the existing SVG lanes — one canvas
   under the `<svg>`, the SVG's ribbon layers removed. Measurable on its own
   with `multiway-drag.probe.ts` (zoom step React ms).
2. Lanes, then chrome, then the SVG stack goes.
3. Per-base alignment lanes are a consumer of this and not part of it —
   [multiway-synteny-lgv-track.md](../ideas/multiway-synteny-lgv-track.md)
   §"Per-base alignment lanes".

Still open on the model side, from the same doc: when a hold breaks the lane
jumps to its full re-alignment in one step; the re-alignment should slide the
least distance that restores coverage.
