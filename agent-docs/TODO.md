# Active Work Items

**Updated:** 2026-04-18 | Move completed items to
`agent-docs/completed/COMPLETED.md`. Top priorities (P1–P5) live in `PRD.md`;
this file is the categorized backlog.

---

## Architecture follow-ups

**`renderProps() { notReady: true }` → explicit opt-out.** Add
`useBlockRenderer: boolean` to the base display model; GPU-family displays
override to `false` via the mixin. Update `svgExportUtil.ts`,
`SVGLinearGenomeView.tsx`, `serverSideRenderedBlock.ts`; delete the misleading
`renderProps()` stub from the mixin.

**Migrate `rpcDataMap` to `observable.map`.** Every plugin's per-region map
is copied-then-assigned on every setter. Move to
`observable.map<number, T>()` with in-place `.set(…)`. Prerequisite for
per-key upload autoruns in `startGpuBackendAutorunLifecycle`.

**Canvas label relayout without refetch.** `showLabels` / `showDescriptions`
flow through `rpcProps` so changing them refetches, but the worker output
doesn't depend on label placement (main thread re-derives via the cached
`rpcDataMap` view — see `plugins/canvas/.../baseModel.ts`). Remove them from
the RPC payload; add a fetchAutorun assertion that `setShowLabels` does NOT
trigger RPC.

Blocked by the `ConfigOverrideMixin` reactivity issue below — a targeted
"destructure label fields out of the RPC payload" fix doesn't work because
`rpcProps` transitively depends on `configOverrides` as a whole frozen
object.

**`ConfigOverrideMixin` reactivity + type safety.** `configOverrides` is a
single `types.frozen<Record<string, unknown>>()` atom. `setOverride('k', v)`
replaces the whole object, so every consumer that reads any key depends on
every other key. Concrete consequence in canvas: `SettingsInvalidate` reads
`rpcProps`, `rpcProps` spreads `displayConfigSnapshot`, `displayConfigSnapshot`
spreads `configOverrides` — so toggling `showLabels` invalidates `rpcProps`
and triggers a refetch even when the worker output is label-independent. No
clean workaround exists inside the current mixin shape (a destructure in
`rpcProps` still subscribes to the whole frozen object via mobx).

Same latent issue affects every display that uses `ConfigOverrideMixin` +
SettingsInvalidate-style autoruns: variants `LDDisplay` (19 overrides),
`MultiSampleVariantBaseModel` (7), alignments. They happen not to feel it
today only because their overrides all *do* warrant refetches.

Secondary: `getConfWithOverride<T>(key)` is typed by caller assertion —
rename a config field and nothing warns. `DisplayConfig` (canvas) is
hand-maintained to parallel `baseConfigSchema.ts` with no compiler
enforcement that they agree.

Directions considered (none landed in the derived-layout PR — scope was too
broad and design choices non-obvious):
- *Per-field typed `*Override` props on one display.* Consistent when every
  override moves; hacky as a partial split.
- *Treat UI-toggle fields as non-config state.* Pull `showLabels`/
  `showDescriptions` out of the schema; make them plain MST props. Small,
  resolves the canvas-specific issue, but breaks admin config defaults for
  those two fields.
- *Retire `ConfigOverrideMixin` plugin-wide, in favor of per-field typed
  props with config fallback.* Cleanest design; cross-plugin refactor.
- *Generate `DisplayConfig` (and peers) from the schema at the type level,
  and have `getConf` return `unknown` by default* — addresses type safety
  independent of the reactivity problem.

Worth a scoped PR that picks one of the last two directions deliberately.

**Backend conformance test suite.** `packages/core/src/gpu/backendConformance.test.ts`
with one `describe.each(ALL_BACKENDS)`. Covers idempotent upload,
render-before-ready no-op, `deleteRegion` / prune absent-key removal,
`dispose()` buffer release (count via `MockHal`), context-loss reinit
equivalence. Land before dotplot / synteny PR-B ship.

**Pickable backend mixin.** `Pickable<HitT>` with
`pick(x, y): Promise<Hit | undefined>`. Synteny needs it. Async-only Promise
absorbs both sync Canvas2D and async WebGPU readback.

**Tab visibility → HAL.** Move `visibilitychange` into the HAL; drops
`useTabVisibilityRerender` and `renderNow()` from the public mixin API.
Post-synteny.

**`regionNumber` → `displayedRegionIndex`.** Mechanical rename (~550 sites,
73 files). Do **last**.

**Dead code sweep (after synteny).** Delete `uploadChangedRegions.ts`,
`uploadRegionDataToGPU`, `pruneRegionMap`, unused `renderProps()` on GPU
displays, `dataVersion` counter. Grep:
`uploadChangedRegions|uploadRegionDataToGPU|pruneRegionMap`.

**Structural `RenderSvgModel`.** Matrix + variants use the structural form;
wiggle / alignments / canvas still import the MST type. Mechanical conversion;
hardens against type circularity across lazy boundaries.

**`chainIdMap` perf.** Gate to `linkedRead + chain highlights active`.
Currently iterates every read × region on every data update.

**Compute shaders → Slang.** Migrate
`plugins/variants/src/VariantRPC/ldComputeShader.ts`,
`ldPhasedComputeShader.ts` to Slang authoring (WebGPU-only; set
`//! targets: wgsl`). See ADR-005.

---

## Infrastructure

**GPU: Build-time WGSL struct size validator** Add Jest test that parses WGSL
and asserts `sizeof(instanceStruct) % 16 === 0`. Currently only caught at
runtime in `WebGPUHal.create`.

**Migrate to pnpm 11** (when released) Remove `"pnpm"` from `package.json`,
update `pnpm-workspace.yaml`, replace `pnpm install --frozen-lockfile` with
`pnpm ci` in CI, bump `pnpm/action-setup` version to 11.

---

## Display Types

**HiC and LD multi-region upload** Switch from single-region to per-region
pattern: `rpcDataMap: Map<number, Data>`, use `uploadChangedRegions`, pass
`regionNumber` to `renderer.uploadRegion()`, pass block array to
`renderBlocks()`.

**MultiVariantDisplay per-region optimization** Check if `computeVariantCells`
preserves object identity for unchanged regions, then wire up
`uploadChangedRegions` to skip redundant uploads.

---

## Features & UX

**Alignments curved read links** Reuse breakpoint split view logic in new "Link
with curved lines" mode.

**Synteny viewport culling** LOD improvements for large comparisons (Hs1 vs mm39
slow). Widen margins or soften refetch criterion.

**Canvas offscreen buffer** Add margin rendering to avoid feature re-juggling on
small zooms (like `plugins/sequence`).

**Dotplot re-render** Initial render works; subsequent updates lost. Debug
lifecycle.

**Protein3D on linearbasicdisplay** Consolidation removed it; may need separate
display or restoration.

**Alignments menu reorganization** Collapse rarely-used options (max height,
toggles) into submenu.

**Breakpoint connectors** Smooth out awkward blue/green curves (currently
arbitrary Y increase/loop).

**Synteny/dotplot UX** Linked views, swap axes, better defaults for human vs
mouse.

**Gene glyph compact modes** Add super-compact for dense layouts; side labels
for genes.

**Paired arcs visibility** Non-downward-pointing arcs fail to render.

**Long-range inter-region arcs** Add UI toggle to draw arcs between distant
regions.

---

## Performance & Stability

**Test speed & stability** Browser test suite slow; some flaky tests. Reduce
runtime, fix failures.

**Scroll zoom lag** ~500ms–1s delay after tab switch. Debug LinearGenomeView
reactivity or JS event throttling.

**Canvas SNP cutoff** Remove SNP clickmap at megabase zoom levels (no reason to
render).

**Verify `?renderer=X` param** Check URL parameter functioning.

---

## Config & Sessions

**Global config overrides** Admin-level defaults (e.g., show paired arcs by
default) across all tracks.

**Hash password in share links** Password only needed at startup (read then
deleted). Store in URL hash, clear on first navigation.

**LGVSyntenyDisplay "Query name" coloring** Re-implement removed
color-by-query-name (hash to color).

---

## Polish

**Dark reader compatibility** Multiwiggle/DNA rendering with light backgrounds.

**Fix prettier config** Unwanted quote/semicolon insertion (see
~/src/mysetup.nvim).

**Feature padding & crowding** Right-side canvas padding excessive? Subpixel
drawing crowded?

i am seeing that mouseover on features in plugins/canvas rapidly shows mouseover
shading and then removes it, when though mouse still hovering

---

## Unclear (Verify)

- Methylation mode broken?
- Clustering UI not updating?
- Long-range arcs missing in 1kg demo?
- Overlay synteny should use single canvas, multiple datasets uploaded. dotplot
  already added this recently

## New issues

synteny mouseover is stuck the deletion polygons are extending beyond the linear
genome view boundaries, which means it is not properly corresponding to genomic
coordinates in 3-way volvox, or if i'm wrong, check against origin/main

┌──────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────┐
│ Change │ Benefit │
├──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Removed dead instanceCount uniform │ -1 uniform write/frame, clearer struct │
├──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ FILL_SEGMENTS/EDGE_SEGMENTS as shader constants │ GPU compiler can unroll
segment switch; -2 uniform slots │
├──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Single hermiteEdges call per vertex (was 2 + select) │ ~50% fewer
transcendental ops in vertex shader │
├──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Inline screen-position computation into cull (was duplicated) │ ~4 mul/sub
fewer per vertex │
├──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ GLSL: shared UNIFORMS, HELPERS, SEGMENT_CONSTS via template strings │ 3 copies
of uniforms block → 1; isCulled now uses real struct │
├──────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Renderer: drop FILL_SEGMENTS/EDGE_SEGMENTS imports + uniformU32 view │ No more
u32-slot writes; 13 slots used, 3 reserved for future │
└──────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────┘

What I deliberately didn't touch (worth flagging as follow-ups):

- isCurve moved to uniform — it's per-view, not per-feature (RPC sets all
  instances to the same value). Would save 4 bytes/feature + enable further
  Instance-struct shrinking. Needs RPC to stop emitting isCurves[] and the
  display's renderParams to pass it. ~30-line change across RPC + backend
  types + renderer.
- Shrink Instance struct 64→36 bytes — bundled with the above. Remove the 12
  bytes of padding + 4 bytes of isCurve. That's a 44% per-feature bandwidth cut
  — meaningful for 100K+ features.
- Adaptive segment count — straight non-crossing parallelograms need 6 vertices,
  not 96. Variable-count paths add pipeline complexity; only worth it if
  profiling shows vertex bottleneck.
- Picking pass uses the fill vertex shader — it outputs the same color +
  featureId varyings the fill shader does. That means we're shading every
  fragment twice with the fill pipeline's full vertex work just to get the
  featureId into the picking target. For tight pipelines a leaner picking-only
  vertex shader could skip the color lookup. Marginal.

Want me to do #1+#2 (isCurve uniform + struct shrink) as a follow-up? That's the
biggest remaining win.

## plugins/canvas

When zooming in, it stalls during some 'rerender, making the feature glyphs
frozen and not adjust to the active zoom'

the WebGL is not working

Many features are 'collapsed' to y=0 on ncbi (add logging to investigate and i
can navigate to it)
