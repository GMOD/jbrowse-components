# Active Work Items

**Updated:** 2026-04-20 | Move completed items to
`agent-docs/completed/COMPLETED.md`. PRD.md holds invariants; this file is
the categorized backlog.

Sections roughly in working order — high-leverage architectural items first,
then config / shaders / tests, then bugs and polish.

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

**`packages/wiggle-core` + alignments coverage scaling.** Alignments
coverage on this branch has no scaling config — `origin/main` inherited it
via `LinearSNPCoverageDisplay extends linearWiggleDisplayModelFactory`,
and that inheritance was dropped when coverage moved into
`LinearAlignmentsDisplay`.

*Phase 1 — `packages/wiggle-core`:* extract `getNiceDomain`, `getScale`,
`getOrigin`, `makeScoreNormalizer` from `plugins/wiggle/src/util.ts`.
Add `domainFromStats({scoreMin, scoreMax, scoreMean, scoreStdDev},
autoscaleType, numStdDev)` (the inner half of wiggle's
`computeAutoscaleDomain`). Add `sharedScaleConfigFields()` returning the
shared MST schema (`autoscale`, `minScore`, `maxScore`, `scaleType`,
`numStdDev`). Move `SetMinMaxDialog.tsx` over unchanged. Wiggle re-imports.

*Phase 2 — coverage stats in `packages/alignments-core`:* add
`computeVisibleCoverageStats` + `computeGlobalCoverageStats` over
`Float32Array` depths (two passes: min/max/sum/count, then variance).
Extend `computeCoverageTicks` with `scaleType`.

*Phase 3 — wire into `LinearAlignmentsDisplay`:* spread
`sharedScaleConfigFields()` into the coverage sub-schema, add
`coverageDomain` getter (`domainFromStats` → `getNiceDomain({niced:false})`
clamped by configured min/max), replace the `visibleMaxDepth` autorun with
a `coverageStats` autorun. Render-state carries `coverageDomain` +
`coverageIsLog`.

*Key design call: CPU-side normalization.* Run `makeScoreNormalizer` at
upload time, drop `U_DEPTH_SCALE` uniform, no shader change needed for log
scale. Buffers are small (one float per visible bp). Re-upload on
`coverageDomain`/`coverageIsLog` change. Mirror in Canvas2D + SVG
renderers (`drawCoverageBins`, `drawSnpSegments`, `drawModCovSegments`
already accept `[0,1]`-normalized values).

`getNiceDomain` adds an opt-in `niced` flag (default `true` for wiggle
back-compat); alignments passes `false`. `autoscale: 'global'` initially
omitted from the alignments menu — needs all-regions data which may not be
fetched.

**Tab visibility → HAL.** Move `visibilitychange` into the HAL; drops
`useTabVisibilityRerender` and `renderNow()` from the public mixin API.
Both still used in synteny (`LevelSyntenyCanvas.tsx`,
`MultiSyntenyRendering.tsx`) and dotplot.

**Structural `RenderSvgModel`.** Matrix + variants use the structural form;
wiggle / alignments / canvas still import the MST type. Mechanical
conversion; hardens against type circularity across lazy boundaries.

**Generalize ADR-006 (preserve stale data across refetch) where safe.**
Only viewport-agnostic display types should adopt it; viewport-baked types
keep clearing (the flash is correctness, not UX).

- Preserve: alignments arcs, probably synteny.
- Clear (keep current): wiggle tiles (bin widths), alignments pileup compact
  zoom (pixel-baked glyphs).
- Audit: `MultiSampleVariantDisplay` (different fetch model).

---

## Reactivity cleanup

**Eliminate remaining `untracked()` usage.** Each call is a reactivity
bypass — a sign something is structured wrong. Acceptance:
`grep -rn 'untracked(' plugins/ packages/ --include='*.ts' --include='*.tsx'
| grep -v test | grep -v '\.md' | wc -l` returns 0 (currently 5).

- `plugins/alignments/.../LinearAlignmentsDisplay/model.ts:1563`
  (`sortLayout` autorun wraps rpcDataMap-read-then-mutate). *Fix:* convert
  `computeAndAssignLayoutForData` to a pure function returning a fresh
  laid-out map; expose laid-out data as a cached MST view (canvas's pattern).
  Upload autorun reads the derived view; no imperative writeback. Largest
  payoff.
- `plugins/graph/.../GraphCanvas.tsx:186` (`viewportBounds` via untracked
  inside a scale/translate update). *Fix:* pan/zoom live on React state
  here, not MST. Move `computeViewportBounds` to a `useMemo` keyed on the
  scale/translate values. Standalone, low urgency.

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

**Renderer property promotion check** for `CanvasFeatureRenderer`,
`SvgFeatureRenderer`, `ArcRenderer`, `LollipopRenderer` — no migration
expected, but confirm promotion works.

---

## Shader work

**Compute shaders to Slang.** `plugins/variants/src/VariantRPC/{ldComputeShader,
ldPhasedComputeShader}.ts` are hand-written WGSL (WebGPU-only). Migrate to
Slang with `//! targets: wgsl`. Not urgent — they work.

**Build-time WGSL struct-size validator.** Jest test asserting
`sizeof(instanceStruct) % 16 === 0`. Currently caught only at runtime in
`WebGPUHal.create`.

**Synteny: `isCurve` → uniform + Instance struct shrink.** `isCurve` is
per-view (same value for every instance in a draw call). Move to Uniforms;
stop emitting `isCurves[]` from the RPC; pass via `renderParams`. Remove
`isCurve : ATTR6` from Instance struct. ~30-line change across RPC,
`syntenyBackendTypes`, renderer, `syntenyTypes.slang`.

---

## CI / Test infrastructure

**WebGPU CI.** Chrome flags set in `runner.ts`, Vulkan missing. Add
Lavapipe (`mesa-vulkan-drivers`) + `xvfb-run` with
`VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`. See
`TEST_INFRASTRUCTURE.md`.

**Browser suite speed & flake reduction.** Slow runtime, intermittent
failures.

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

**Synteny mouseover stuck.** `hoveredFeatureIdx` doesn't clear when moving
off features. `dispatchHoverPick` fires `backend.pick` async; if
`this.inFlight` never resolves (e.g. `onResult` throws in the second
`.then()` of `drainPickQueue`), no further hover picks run. Reproduce with
3-way volvox synteny.

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

**Canvas: features collapsed to y=0 on NCBI.** Add logging to investigate;
needs reproduction steps.

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

**Alignments log scale.** Example exists on `origin/main`. Folds into the
wiggle-core extraction above.

**Decouple amino-acid overlay loading**, treat density gate as one-shot →
drop canvas `isCacheValid` entirely.

---

## Polish

**Dark reader compatibility.** Multiwiggle/DNA rendering with light
backgrounds.

**Feature padding & crowding.** Right-side canvas padding excessive?
Subpixel drawing crowded?

---

## Verify

- Clustering UI not updating?
- `?renderer=X` URL parameter working?

Wiggle scale ticks not visible despite yscalebaroffset
