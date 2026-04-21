# Active Work Items

**Updated:** 2026-04-20 | Move completed items to `agent-docs/completed/COMPLETED.md`. PRD.md holds invariants; this file is the categorized backlog.

Sections roughly in working order — high-leverage architectural items first, then config / tests, then bugs and polish.

---

## Architecture & infrastructure

**Backend conformance test suite.** One `describe.each(ALL_BACKENDS)` at
`packages/core/src/gpu/backendConformance.test.ts` covering: idempotent upload,
render-before-ready no-op, `deleteRegion` / prune absent-key removal,
`dispose()` buffer release (count via `MockHal`), context-loss reinit
equivalence. Catches per-backend drift.

**Pickable backend mixin.** `Pickable<HitT>` with
`pick(x, y): Promise<Hit | undefined>`. Unifies async WebGPU readback with
sync Canvas2D picking; synteny needs it.

**Alignments coverage scaling (remaining).** Phases 1–3 done (see
COMPLETED.md). Remaining: CPU-side normalization — run `makeScoreNormalizer`
at upload time and re-upload coverage buffers on domain/scale change so the
GPU shader doesn't need `depthScale` (enables true log scale GPU rendering).
Add `uploadCoverage(idx, data)` to `AlignmentsBackend`; add a separate
autorun in model that watches `coverageDomain`/`coverageIsLog` and
re-uploads. Drop `U_DEPTH_SCALE` uniform from shader after.

**Structural `RenderSvgModel`.** Matrix + variants use the structural form;
wiggle / alignments / canvas still import the MST type. Mechanical
conversion; hardens against type circularity across lazy boundaries.

---

## Reactivity cleanup

**Eliminate remaining `untracked()` usage.** Acceptance:
`grep -rn 'untracked(' plugins/ packages/ --include='*.ts' --include='*.tsx'
| grep -v test | grep -v '\.md' | wc -l` returns 0 (currently 4).

- `plugins/graph/.../GraphCanvas.tsx:186` (`viewportBounds` via untracked
  inside a scale/translate update). *Fix:* pan/zoom live on React state
  here, not MST. Move `computeViewportBounds` to a `useMemo` keyed on the
  scale/translate values. Standalone, low urgency.
- `MultiRegionDisplayMixin.ts:194,231,303` — three `untracked` guards in
  the fetch autorun. All intentional: line 194 prevents `isLoading` from
  being a tracked dependency (would cause the autorun to re-fire when a
  fetch completes, creating a busy-loop); line 231 reads `loadedRegions`
  without tracking (completion of one region fetch should not re-trigger
  the "what needs fetching" scan); line 303 reads `error`/`regionTooLarge`
  without tracking (only viewport changes should fire the clear). These are
  structural, not accidental — accept or find a reaction-based alternative.

Test-file `untracked` calls (`fetchAutorunIntegration.test.ts`) are
intentional — leave alone.

**Canvas label relayout without refetch (blocked).** `showLabels` /
`showDescriptions` flow through `rpcProps` so changing them refetches, but
worker output doesn't depend on label placement (main thread re-derives
via cached `rpcDataMap` view). Blocked by `ConfigOverrideMixin` reactivity
below — destructuring label fields out of `rpcProps` doesn't help because
mobx subscribes to the whole frozen object.

*Partial mitigation via ADR-006:* refetch still fires spuriously, but
`rawRpcDataMap` is no longer cleared during it, so labels don't visually
disappear.

**`ConfigOverrideMixin` reactivity + type safety (blocked, scoped PR
needed).** `configOverrides` is a single
`types.frozen<Record<string, unknown>>()` atom — `setOverride('k', v)`
replaces the whole object, so every consumer that reads any key depends on
every other. Concrete consequence: toggling `showLabels` invalidates
canvas's `rpcProps` (which spreads `displayConfigSnapshot` which spreads
`configOverrides`) and triggers a refetch even when worker output is
label-independent. Same latent issue affects `LDDisplay` (19 overrides),
`MultiSampleVariantBaseModel` (7), alignments — they happen not to feel it
because their overrides do warrant refetches.

Secondary: `getConfWithOverride<T>(key)` is typed by caller assertion —
rename a config field, nothing warns. `DisplayConfig` (canvas) is
hand-maintained to parallel `baseConfigSchema.ts` with no compiler
enforcement.

Directions considered (none landed in derived-layout PR — scope too broad):

- *Per-field typed `*Override` props on one display.* Consistent if every
  override moves; hacky as a partial split.
- *Treat UI-toggle fields as non-config state.* Pull `showLabels` /
  `showDescriptions` out of the schema, plain MST props. Small, fixes the
  canvas-specific issue, breaks admin defaults for those fields.
- *Retire `ConfigOverrideMixin` plugin-wide* in favor of per-field typed
  props with config fallback. Cleanest; cross-plugin.
- *Generate `DisplayConfig` from the schema at the type level*, have
  `getConf` return `unknown` by default — addresses type safety
  independent of reactivity.

Worth a scoped PR picking one of the last two deliberately.

---

## Config migration

**PileupRenderer → display-level config.** Old configs with
`configuration.renderer.type === 'PileupRenderer'` silently drop
`featureHeight`, `featureSpacing`, `maxHeight`, `colorBy`, `filterBy`. Add
`migrateDisplayConfiguration()` and wire into the snapshot migration path.
Verify `config_demo.json` and `volvox/config.json` load with JEXL color
expressions intact. See `CONFIG_PATTERN.md`.

---

## CI / Test infrastructure

**WebGPU CI.** Chrome flags set in `runner.ts`, Vulkan missing. Add
Lavapipe (`mesa-vulkan-drivers`) + `xvfb-run` with
`VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`. See
`TEST_INFRASTRUCTURE.md`.

**Browser suite speed & flake reduction.** See `TEST_INFRASTRUCTURE.md` for
known slow tests and flake sources. Fresh-tab approach and analytics blocking
documented in `project_browser_test_perf.md` memory.

---

## Performance

**`chainIdMap` perf.** Gate to `linkedRead + chain highlights active`.
Currently iterates every read × region on every data update.

**Scroll zoom lag.** ~500ms–1s delay after tab switch. Debug
LinearGenomeView reactivity or JS event throttling.

**Canvas SNP cutoff.** Remove SNP clickmap at megabase zoom levels (no
reason to render).

---

## Bugs

**Synteny deletion polygons extend beyond LGV boundaries.** In 3-way
volvox, CIGAR `D`/`N` polygons visually exceed the LGV coordinate range.
Check `computeCorners` in `syntenyTypes.slang` against `adjOff`/`scale`
uniforms in `GpuSyntenyRenderer.writeUniforms`, and the CIGAR `cx1`
accumulation in `executeSyntenyInstanceData.ts`. Compare against
`origin/main` to rule out regression.

**LinearSyntenyDisplay GPU leak on chromosome navigation.** MultiLGV
variant got `clearDisplaySpecificData()` + prune-on-empty-set.
`LinearSyntenyDisplay` (2-way) has no equivalent —
`stateModelFactory.ts` never calls `clearAllBlocks()` when navigating to a
new chromosome. Check whether stale GPU buffers accumulate.

---

## Features & UX

**Synteny viewport culling LOD** for large comparisons (Hs1 vs mm39 slow).
Widen margins or soften refetch criterion.

**Protein3D on linearbasicdisplay.** Consolidation removed it; may need
separate display or restoration.

**Synteny / dotplot UX.** Linked views, swap axes, better defaults for
human vs mouse.

**Gene glyph compact modes.** Add super-compact for dense layouts; side
labels for genes.

**Alignments log scale (GPU).** UI wiring done (Phase 3: scaleType config,
`coverageIsLog` getter, Scale type menu). GPU rendering still uses the
linear `depthScale` uniform — log scale visually wrong on GPU path. Blocked
by CPU normalization item above (the remaining coverage work).

**Decouple amino-acid overlay loading**, treat density gate as one-shot →
drop canvas `isCacheValid` entirely. See implementation plan below.

---

## Amino-acid overlay decoupling — implementation plan

Goal: make the amino-acid overlay a separate lazy fetch so crossing the
`shouldRenderPeptideBackground` threshold (1 bpPerPx) no longer invalidates
the main feature cache and triggers a full region refetch.

**Step 1 — Extract `buildAminoAcidOverlay` from `collectRenderData`.**
The peptide overlay items are currently built inside `collectRenderData` as a
side-effect of processing each transcript (`collectRenderData.ts:231–283`,
writing into `collector.aminoAcidOverlay`). Pull that logic into a standalone
`buildAminoAcidOverlay(layouts, peptideDataMap, config, theme, regionStart):
AminoAcidOverlayItem[]` function in the peptides directory so it can be called
independently.

**Step 2 — Add `FetchPeptideOverlay` RPC.**
New worker entry point (mirroring the structure of `executeRenderFeatureData`)
that: fetches features for the region, builds layouts via `layoutFeature`,
calls `fetchPeptideData`, then calls `buildAminoAcidOverlay`. Returns
`AminoAcidOverlayItem[]`. Register alongside `RenderFeatureData` in
`canvasRpcMethods.ts`. Note: this re-fetches features from the adapter, but
the adapter's in-memory cache means no extra network round-trips for most
sources.

**Step 3 — Remove peptide fetch from main RPC.**
In `executeRenderFeatureData`: delete the `peptideDataMap` block (lines
132–148). Pass `undefined` for `peptideDataMap` in the `collectRenderData`
call. Drop `aminoAcidOverlay` from `FeatureDataResult` and `rpcTypes.ts`.
`collectRenderData` still accepts optional `peptideDataMap` (now always
undefined from the main path) — clean it up or leave for now.

**Step 4 — Add `peptideOverlayMap` volatile to canvas model.**
In `baseModel.ts`: add `peptideOverlayMap: observable.map<number,
AminoAcidOverlayItem[]>()` as a volatile. Add a second autorun (alongside the
existing fetch autorun) that watches `shouldRenderPeptideBackground(view.bpPerPx)`
and `colorByCDS`:
- When above threshold: clear `peptideOverlayMap`.
- When below threshold: for each `displayedRegionIndex` present in `rpcDataMap`
  but absent from `peptideOverlayMap`, call `FetchPeptideOverlay` and store the
  result. This is the "one-shot" — already-loaded regions skip the fetch.

**Step 5 — Wire overlay into `computeLaidOutData`.**
In `layout.ts`, `computeLaidOutData` currently reads `raw.aminoAcidOverlay` from
the RPC result and adjusts `topPx` via `featureOffsets[aa.flatbushIdx]`. Change
it to read from `self.peptideOverlayMap.get(displayedRegionIndex)` instead.
The `featureOffsets` adjustment stays the same.

**Step 6 — Update SVG renderer.**
`renderSvg.tsx` reads `data.aminoAcidOverlay` from the per-region data object.
Plumb the overlay in as a separate argument sourced from `peptideOverlayMap`.

**Step 7 — Drop canvas `isCacheValid`.**
Remove the override from `baseModel.ts` (lines 626–636). Canvas now uses the
base-class default (`() => true`). Update `CLAUDE.md` and
`agent-docs/ARCHITECTURE.md` to remove the canvas exception from the
"Per-region zoom-staleness" section.

**Step 8 — Clean up types and tests.**
Remove `aminoAcidOverlay` from `FeatureDataResult`. Update `fetchAutorun.test.ts`
if any canvas-specific `isCacheValid` tests existed. Add a unit test for the new
autorun: loads a region, zooms past threshold, verifies `FetchPeptideOverlay`
was called once and result cached; zooms back out, verifies map cleared; zooms
in again, verifies called again.

---

## Bugs (continued)

**ReadCloud: excessive `Core-preProcessTrackConfig` log spam.** Adding a
`LinearReadCloudDisplay` with `drawCloud:true` for `volvox_sv_cram` causes
`pluginManager.addToExtensionPoint('Core-preProcessTrackConfig', ...)` to be
called repeatedly on every mouse move. Also triggers repeated "If it's a
frozen/plain object, we need to instantiate it" warnings. Investigate why
track config pre-processing is running in a hot path.

---

## Verify

- Clustering UI not updating?
- `?renderer=X` URL parameter working?
- Canvas: right-side padding excessive? Subpixel drawing crowded at dense zoom?
- Canvas: features collapsed to y=0 on NCBI (needs reproduction steps).
