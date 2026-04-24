# Active Work Items

**Updated:** 2026-04-24 | Move completed items to `agent-docs/completed/COMPLETED.md`. PRD.md holds invariants; this file is the categorized backlog.

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

**`getRpcSessionId` for `plugins/graph`.** Consider using the view id (currently unset).

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

**Dotplot feature requests debounced / slow.** Review request timing in dotplot.

**`paf_chain2paf` / `parseCigar2` speed.** Profile and optimize.

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

**Duplicated CIGAR accumulation loop (worker vs. SVG export).**
`buildSyntenyGeometry.ts:372-442` and `drawRef.ts:132-210` implement the
same small-indel merging + op-classification + off-screen-culling loop,
but one writes polygons into typed arrays (worker) and the other issues
Canvas2D draws (SVG export path). Both carry the same suspect expression
at line 406 / 177 respectively (see below) — any fix needs to land in
both. Extraction candidate: a generator-style `iterateCigarSegments`
yielding `{ px1, cx1, px2, cx2, resolvedOp, continuingFlag }` that each
caller consumes. Non-trivial; defer until the suspect expression is
resolved so the refactor doesn't preserve a bug.

**Suspect CIGAR op classification in `buildSyntenyGeometry.ts:406`
(also `drawRef.ts:177`).**
`const resolvedOp = (continuingFlag && d1 > 1) || d2 > 1 ? op : CIGAR_M`.
The asymmetric precedence — `continuingFlag` gates only the `d1 > 1` arm,
not `d2 > 1` — looks like a typo. Likely-intended forms:
`continuingFlag && (d1 > 1 || d2 > 1)` or plain `(d1 > 1 || d2 > 1)`.
Expression has been there since PR #2874 (2022-04) so may be load-bearing
in a non-obvious way. To verify: construct a PAF/CIGAR where a small-indel
run (continuingFlag=true) resolves on an op with `d2 > 1, d1 < 1` and
check whether the emitted color matches the op or falls through to
`CIGAR_M`. If miscolor reproduces, the fix is trivial.

**Synteny location markers never reach polygon endpoint.**
`buildSyntenyGeometry.ts:250-251`: `t = step / numMarkers` with
`step < numMarkers` produces t ∈ [0, (n-1)/n] — the last marker lands
short of the right edge. May be intentional (avoid overlap at polygon
joins), but the `+1` in the `numMarkers` calc at line 245 suggests
someone was trying to compensate. To verify: screenshot a single-polygon
synteny feature at high zoom and check whether markers reach both
endpoints symmetrically. Fix if not: divide by `numMarkers - 1` (safe
because `numMarkers >= 2` is already enforced).

**SyRI z-ordering in GPU path.** Canvas2D and SVG export now draw SYN first so
INV / TRANS / DUP ribbons appear on top (plotsr-compatible). The WebGL2 and
WebGPU paths do not yet respect this order — instances are drawn in arrival
order. To fix: sort the `SyntenyInstanceData` arrays at `uploadGeometry` time
so SYN instances come first; or use depth-buffer values (SYN = 0.5, others =
0.0) in `syntenyFill.slang`. The latter avoids re-sorting but requires a shader
change.

**Alignments `regionSequence` undefined error.** Seen in the wild:
`TypeError: can't access property "toUpperCase", regionSequence[(position - regionSequenceStart)] is undefined`
in `computeModificationCoverage.ts:80` / `executeRenderPileupData.ts:178`.
Needs a reproduction case.

---

## Features & UX

### Synteny large-data interactivity

Four independently-landable items, ordered by ROI for whole-genome alignment
(millions of features). `colorBy` is already main-thread (see recent
`LinearSyntenyDisplay` refactor: per-instance `kinds`/`instanceFeatureIdx` +
`renderInstanceData` getter); the items below tackle pan/zoom/pick.

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
   range and `bpPerPx` is unchanged. Medium scope. Complementary to #3:
   #2 eliminates pan re-fetches on indexed adapters (where region-eager
   fetch would OOM); #3 eliminates zoom re-fetches and fixes deep-zoom
   precision. Different problems, both worth doing.

3. *GPU-smooth-zoom (full alignments-style architecture).* Worker emits
   absolute genomic uint32 per vertex (not float32 pixel offsets). Shader
   converts bp → clip via `hpMath` against per-view `bpHi/bpLo/bpLen`
   uniforms — top verts use view-A, bottom verts use view-B. Touches
   `syntenyTypes.slang`, `syntenyFill/Edge/Picking.slang`,
   `instanceInterleave.ts`, `buildSyntenyGeometry.ts` (CIGAR layout in bp
   not pixels), `GpuSyntenyRenderer.writeUniforms`,
   `Canvas2DSyntenyRenderer` (bp→pixel per frame),
   `executeSyntenyFeaturesAndPositions.ts`. Medium risk; needs browser-
   test coverage.

   **Honest value prop** (revised after diagnosis): this buys (a) deep-
   zoom precision — float32 pixel offsets drift once you zoom past ~2×
   the worker's geometry `bpPerPx`, which bp uint32 + `hpMath` fixes; (b)
   zoom becomes a zero-RPC uniform update instead of a worker re-run
   (today any `bpPerPx` change invalidates the pixel-space buffer).

   It does **not** on its own fix pan smoothness — with the
   `pairwiseIndexedPAFadapter` the worker legitimately streams per-block
   data, so panning into new blocks will still RPC regardless of output
   format. Pan smoothness is #2's problem (widen the margin, cache by
   loaded range), not #3's. Sell this on precision + zoom-RPC removal.

   Multi-region handling: one draw call per `(topRegionIdx, botRegionIdx)`
   pair per strip, with per-region `bpHi/bpLo/bpLen` uniforms — mirrors
   alignments' per-block draw pattern, doubled. Features that straddle
   a region boundary on either strip are rare; simplest handling is to
   split at the boundary during worker-side bucketing.

4. *`drawCIGAR` / `drawCIGARMatchesOnly` / `drawLocationMarkers` →
   gpuProps.* Worker always emits full CIGAR + marker geometry; per-
   instance `kind` already distinguishes them. Add shader uniform bit
   flags gating draw; `computeSyntenyColors` respects the same flags.
   Payload always pays CIGAR cost — only worth it if users toggle these
   frequently. Optional polish.

Recommended sequence: **1 → 2 → 3**. #2 and #3 are complementary (pan
smoothness vs. zoom precision), not substitutes. 4 is optional.

### Synteny misc UX

- Linked views, swap axes, better defaults for human vs mouse.
- Collapse synteny view: add a button to collapse each LinearGenomeView row
  to a single thin line (~1–2 px). The LGV currently takes ≥150 px of chrome,
  which limits the number of synteny rows visible at once; collapsing rows
  would dramatically increase capacity for multi-way comparisons.

### Synteny adapters & classification

**SyRI adapter (browser).** Add a `SyriOutAdapter` that reads raw `syri.out`
files directly in the browser (or a bgzipped + tabix-indexed version). The
CLI already has `make-pif/parsers/syri-parser.ts` with the correct column
mapping (`refChr refStart refEnd - - qryChr qryStart qryEnd ID parent type`).
A browser adapter would emit `syriType` directly from column 10, bypassing the
`computeSyriTypes` inference entirely and giving exact classifications including
`INVTR` (inverted translocation) which the inference currently maps to TRANS.
Acceptance: load `test/data/synteny-demo/plotsr/syri.out` and confirm SYN /
INV / TRANS / DUP / INVTR / INVDP are all colored correctly.

**SyRI `computeSyriTypes` cross-validation.** Add a test that parses a real
`syri.out` file, extracts the SYNAL/INVAL/TRANSAL/DUPAL alignment rows, feeds
them into `computeSyriTypes` as PAF-like records, and checks that the inferred
types match the types declared in the file. Surfaces any remaining inference
divergence.

**SyRI `INVTR` / `INVDP` types.** `computeSyriTypes` and `SyriType` currently
do not model inverted translocation (`INVTR`) or inverted duplication (`INVDP`).
These are real SyRI output types (plotsr folds `INVTR` → `TRANS` and `INVDP` →
`DUP`). Consider adding them as first-class types with distinct colors, or
explicitly document the fold in the code.

### Alignments

- True samplot-style plots:
  - Implement samplot color palette (Phase 1)
  - Update arc computation for SV classification (Phase 2)
  - Update GPU renderer for stacked arc layout (Phase 3)
- Modifications track: use smoothed line for wiggle coverage of methylation
  (matrix-style view, see [#5510](https://github.com/GMOD/jbrowse-components/issues/5510))

### Graph view

- Self-loops render too large
- Allows too far zoom out
- Header buttons/options should match other view headers visually
- Sequence search / BLAST (similar to Bandage)
- Test on large GFA files
- Interactive force-directed layout
- Customizable layout (e.g. choose d3-force layout at runtime)
- Interactive mouseover connection between LinearGenomeView and graph

### Gene glyphs

- Add super-compact mode for dense layouts
- Side labels for genes

---

## Verify

- Clustering UI not updating?
- `?renderer=X` URL parameter working?
- Canvas: right-side padding excessive? Subpixel drawing crowded at dense zoom?
- Canvas: features collapsed to y=0 on NCBI (needs reproduction steps).

---

## Cleanup

- MUI v9 migration: review checklist at https://mui.com/material-ui/migration/upgrade-to-v9

---

## Backlog / stretch

- SVPlaudit-style game but with JBrowse
- Static renderings via `jbrowse-img`; command-line tool for batch variant rendering
