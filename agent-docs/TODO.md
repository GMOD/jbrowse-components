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

**Surgical node dragging in `plugins/graph`.** Currently, moving a single node
triggers a full `buildGeometry` and `uploadGeometry` for the entire graph
(all nodes and edges) via the `viewportDirty` flag.
- *Optimization:* Implement `updateSubBatchGeometry` in `GraphRenderer`
  backends to allow partial buffer updates.
- *Action:* Update `moveNode` to only re-tessellate the dragged node and
  its connected edges, then push only those vertex slices to the GPU.
- *Prerequisite:* Demonstrate slowness with a large graph example (e.g.,
  10k+ nodes) using the added `[Graph Performance]` console logging.

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

**Synteny large-data interactivity.** Four independently-landable items,
ordered by ROI for whole-genome alignment (millions of features). `colorBy`
is already main-thread (see recent `LinearSyntenyDisplay` refactor: per-
instance `kinds`/`instanceFeatureIdx` + `renderInstanceData` getter); the
items below tackle pan/zoom/pick.

1. *Canvas2D picking spatial index.* `Canvas2DSyntenyRenderer.pick()` is
   O(n) per hover across all tracks + instances. Build a Flatbush over
   `(min(x1..x4), 0, max(x1..x4), height)` AABBs at `uploadGeometry`
   time; query returns a short candidate list for `isPointInPath`.
   Pattern mirrors alignments chain-mode. Small scope, GPU path
   unaffected. Low risk.

2. *Pan-cache via widened worker cull + range check.* Today worker culls
   at `0.5× viewWidth`; every pan fires RPC + debounced rebuild. Grow
   margin to ~`2× viewWidth` per side, return the actual emitted genomic
   range, have `afterAttach` skip the RPC when new viewport ⊂ loaded
   range and `bpPerPx` is unchanged. Medium scope. Subsumed by #3 if
   that lands, but a good interim.

3. *GPU-smooth-zoom (full alignments-style architecture).* Worker emits
   absolute genomic uint32 per vertex (not float32 pixel offsets). Shader
   converts bp → clip via `hpMath` against per-view `bpHi/bpLo/bpLen`
   uniforms — top verts use view-A, bottom verts use view-B. Pan and zoom
   become zero-CPU uniform updates; RPC only fires on feature-set change.
   Touches `syntenyTypes.slang`, `syntenyFill/Edge/Picking.slang`,
   `instanceInterleave.ts`, `buildSyntenyGeometry.ts` (CIGAR layout in bp
   not pixels), `GpuSyntenyRenderer.writeUniforms`,
   `Canvas2DSyntenyRenderer` (bp→pixel per frame),
   `executeSyntenyFeaturesAndPositions.ts`. Medium risk; needs browser-
   test coverage. Makes #2 moot; this is the architecturally correct
   endgame and matches the pattern documented in ARCHITECTURE.md.

4. *`drawCIGAR` / `drawCIGARMatchesOnly` / `drawLocationMarkers` →
   gpuProps.* Worker always emits full CIGAR + marker geometry; per-
   instance `kind` already distinguishes them. Add shader uniform bit
   flags gating draw; `computeSyntenyColors` respects the same flags.
   Payload always pays CIGAR cost — only worth it if users toggle these
   frequently. Optional polish.

Recommended sequence: **1 → 3**. Skip 2 if committing to 3. 4 is optional.

**Synteny / dotplot UX.** Linked views, swap axes, better defaults for
human vs mouse.

**Gene glyph compact modes.** Add super-compact for dense layouts; side
labels for genes.




## Verify

- Clustering UI not updating?
- `?renderer=X` URL parameter working?
- Canvas: right-side padding excessive? Subpixel drawing crowded at dense zoom?
- Canvas: features collapsed to y=0 on NCBI (needs reproduction steps).

## Internal

- getRpcSessionId for plugins/graph, maybe use view id

## Alignments

- True samplot style plots
  - [ ] Implement samplot color palette (Phase 1)
  - [ ] Update arc computation for SV classification (Phase 2)
  - [ ] Update GPU renderer for stacked arc layout (Phase 3)

## Cleanup

Look at mui v9 migration checklist https://mui.com/material-ui/migration/upgrade-to-v9

## Graph issues/Features

- Self loops too large
- allows too far zoom out
- The header buttons and options should look more like other view headers
- Sequence search/blast similar to bandage
- Test on large GFA files
- interactive force directed layout
- Customizable layout e.g. choose d3-force layout at runtime
- Interactive mouseover connection between linear genome view and graph and vice versa


## Game

- Make SVPlaudit but with jbrowse
- Static renderings of jbrowse still needed with jbrowse-img
- Command line tool that can do this for many many variants quickly

## Alignments

- snP tooltips should add +1 to coord

- Modifications and methylation coloy by modes does not want to color snps, it should color snps grey

- Potentially weird for our demo data but saw : Fetch failed: TypeError: can't access property "toUpperCase", regionSequence[(position - regionSequenceStart)] is undefined
    computeModificationCoverage webpack://@jbrowse/web/../../plugins/alignments/src/shared/computeModificationCoverage.ts?:80
    executeRenderPileupData webpack://@jbrowse/web/../../plugins/alignments/src/RenderPileupDataRPC/executeRenderPileupData.ts?:178
FetchMixin.ts:98:19

- Error boundary message is narrow, why not show entire message, also stack trace needed in error banner
- Clicking on snpcoverage modifications needs to get details in sidebar widget. clicking on modifications on pileup reads also

- Modifications track - use smoothed line for wiggle coverage of methylation using matrix style view https://github.com/GMOD/jbrowse-components/issues/5510

## Synteny

- Very poor synteny anti aliasing right now, please review, may be recent regression on this branch

- Dotplot sort of slow or debounced feature requests, review

- Speed up paf_chain2paf, parseCigar2

## Breakpoint

- Closing tracks or something else to see if it works
