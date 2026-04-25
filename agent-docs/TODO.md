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

**Dotplot: consolidate features + positions into one RPC (match synteny
pattern).** Today `plugins/dotplot-view/src/DotplotDisplay/afterAttach.ts`
runs two cascaded autoruns — `CoreGetFeatures` → main-thread
`serializeFeatures` → `DotplotGetWebGLGeometry`. With `RPC_DEBOUNCE_MS =
1000` on each, pan-into-new-blocks waits ~2 s for geometry. Serialize is
O(N) `.get()` + `assemblyManager.getCanonicalRefName` per feature — fine
at ~10 k, real stall at ~100 k.

*Target:* one worker RPC `DotplotGetFeaturesAndPositions` that fetches
via the adapter, returns flat typed-array `featureData` + px positions
in one round-trip. Reference implementation:
`plugins/linear-comparative-view/src/LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts`
(result shape, transferables list) and the post-refactor
`plugins/linear-comparative-view/src/LinearSyntenyDisplay/afterAttach.ts`
(single-autorun consumer).

*Wins:* eliminates main-thread `serializeFeatures`; one debounce instead
of two; collapses `setFeatures` + `setFeatPositions` into one
`setRpcData`-style action (one upload-autorun fire per result); drops
`self.features: Feature[]` from volatile state.

*Touches:* new `DotplotGetFeaturesAndPositions.ts` + `executeDotplotFeaturesAndPositions.ts`
(merge with current `executeDotplotWebGLGeometry.ts`); delete
`DotplotGetWebGLGeometry` RPC; rewrite `afterAttach.ts` single-autorun;
update `stateModelFactory.tsx` volatile + `isLoading`/`isRefetching`
getters; grep `self.features` inside dotplot plugin and rewrite to index
flat typed arrays (`DotplotRenderer`, `buildLineSegments`, SVG export,
`DotplotSemanticZoom`). Canonical refName resolution moves server-side
via `getSession(pluginManager).assemblyManager` — same hook synteny's
worker uses. No public API break; all consumers are inside this plugin.

**`paf_chain2paf` / `parseCigar2` speed.** Profile and optimize.

---

## Bugs

**Synteny deletion polygons extend beyond LGV boundaries.** In 3-way
volvox, CIGAR `D`/`N` polygons visually exceed the LGV coordinate range.
Check `computeCorners` in `syntenyTypes.slang` against `adjOff`/`scale`
uniforms in `GpuSyntenyRenderer.writeUniforms`, and the CIGAR `cx1`
accumulation in `executeSyntenyFeaturesAndPositions.ts`. Compare against
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
   range and `bpPerPx` is unchanged. Medium scope. Eliminates pan
   re-fetches on indexed adapters (where region-eager fetch would OOM).

3. *Worker-side integer-bp CIGAR walk (precision only, conditional).*
   If deep-zoom drift becomes visible in the wild, fix it inside the
   worker without touching the shader/uniform shape. CIGAR accumulator
   runs in integer bp (no Float64->Float32 lossy conversion), converts to
   pixel offsets only at instance-buffer build time. Contained to
   `buildSyntenyGeometry.ts` and `drawDotplotWebGL.ts`. **Don't do this
   speculatively** -- see ADR-010 for why the larger bp+regionIdx +
   hpmath refactor was rejected and why the precision concern is narrow.

Recommended sequence: **1 -> 2**. #3 is conditional on a real precision
report.

### Synteny misc UX

- Collapse synteny view: add a button to collapse each LinearGenomeView row
  to a single thin line (~1–2 px). The LGV currently takes ≥150 px of chrome,
  which limits the number of synteny rows visible at once; collapsing rows
  would dramatically increase capacity for multi-way comparisons.


### Alignments


- Modifications track: methylation line/matrix view (see
  [#5510](https://github.com/GMOD/jbrowse-components/issues/5510)).
  The key value of methylartist locus is distinguishing haplotypes — per-HP
  aggregate lines reveal allele-specific methylation (ASM). Options ranked by
  ROI:

  **Option A — HP-stratified aggregate lines (recommended starting point).**
  One line per haplotype in the coverage area. At each CpG, y = methylation
  proportion among reads with that HP tag (HP:i:1, HP:i:2, unphased). Two
  lines when HP tags present, one when absent. Implementation:
  - Add `haplotype: number | undefined` to `ModificationEntry`; read HP tag
    in `extractModifications` in `processFeatureAlignments.ts`
  - Extend `computeModificationCoverage` to stratify by haplotype; output
    per-haplotype position/height/color arrays
  - Add `drawModCovLine` to `rendererUtils.ts` (Canvas2D) + a new
    `PASS_MOD_COV_LINE` GPU pass (can reuse modCoverage vertex geometry,
    rendered as a strip not quads)
  - Show unphased as a third dim/dashed line or omit when both HP lines present
  - Future option: kernel-smoothed lines (aggregate over a bandwidth of nearby
    CpGs rather than exact per-site values)

  **Option B — Simple aggregate line, no haplotype (lower effort, less
  useful).** Single line per mod type, no HP stratification. Good fallback for
  non-phased data or bisulfite-seq. The worker already produces
  `modCovPositions`/`modCovHeights`; only a `drawModCovLine` renderer and GPU
  shader are needed. Can be done first as a fallback (shown when no HP tags
  detected), then upgraded to Option A. Estimated ~2h.

  **Option C — Per-read matrix with haplotype sort.** The top panel of
  methylartist: rows = reads, columns = CpG sites, color = per-read methylation
  probability, reads sorted HP1-above-HP2 then by methylation fingerprint. This
  is essentially the existing per-read modification squares plus a new sort
  mode. May already be achievable today by combining `colorBy: modifications` +
  `sortBy: HP tag` — worth verifying before building anything. If the UX is
  already sufficient, Option C needs only documentation.

  **Recommended sequence:** B first (~2h), then A (~1d). C last or never.

**Samplot mode follow-ups.** Phase 1+2 landed (flat lines, Y = |tlen|, SV-type
palette, shared Canvas2D ⇄ SVG rasterizer). Remaining:

- *Y-axis jitter.* Done — `SAMPLOT_JITTER_BOUNDS=0.08` applied multiplicatively
  to `|tlen|` at arc build time in `computeArcsFromPileupData.ts`.
- *Alpha 0.25 + dashed split reads.* Done — samplot flat arcs rendered at
  0.25 alpha; SA-tag arcs use `ARC_SHAPE_FLAT_SPLIT` (dashed in both GPU and
  Canvas2D paths).
- *Discardable samplot strand fallback.* `getSamplotColorIndex`'s
  strand-only branch (split reads with no `pairOrientationNum`) collapses
  to same-strand→INV, else→DEL. Proper DUP classification for split reads
  requires reading query order + genomic order together; left un-wired
  because the rare case has limited signal-to-noise.
- *Endpoint markers.* samplot.py draws square markers (`marker="s"`) at both
  ends of paired-read lines and circle markers (`marker="o"`) at split-read
  line ends. Would require generating extra geometry per arc instance in the
  shader (a small square/circle quad at each x1/x2). Canvas2D path would use
  `ctx.fillRect` / `ctx.arc`. Medium scope; skip until visual need is confirmed.
- *Line width: split vs paired.* samplot.py uses `lw=1` for split reads and
  `lw=0.5` for paired reads. Currently both use the same `arcLineWidth`
  uniform. Could pass per-instance width or use two separate draw calls.
  Low visual impact; defer.
- *Y-axis domain margin.* samplot.py uses `ylim_margin = max(1.02 + jitter_bounds, 1.10)`
  (percentage-based, adjusts for jitter). JBrowse uses a fixed 8 px pixel margin
  (`ARC_HEIGHT_MARGIN`). Minor visual difference; defer.


## Canvas

- Canvas: right-side padding excessive? Subpixel drawing crowded at dense zoom?
- Canvas: features collapsed to y=0 on NCBI (needs reproduction steps).

_Items 1, 2, 4, 5 below landed on `webgl-poc` 2026-04-25. Item 3
(regionStart) deferred. Item 6 (offset arrays) attempted and reverted —
see "Offset arrays: rejected approach" below._

**~~Layout asymmetry on reversed regions.~~** _Done._ `packRef` now
takes a `reversedRegions: ReadonlySet<number>` and reserves label
overhang on `layoutStartBp` (lower bp) for reversed regions and
`layoutEndBp` (higher bp) otherwise; mixed regions get both sides. The
asymmetric `layoutEndBp = startBp + labelWidth*bpPerPx` was guaranteed
to either over- or under-reserve in the reversed case. Test added in
`layout.test.ts` (long label on reversed region collides with left
neighbor and forces row split).

**~~Layout description-row height when `showLabels=false`.~~** _Done._
Verified that `packRef`'s height calc already adds `labelFontSize`
for descriptions whenever `showDescriptions && hasDescription`,
independent of `showLabels`. The description gates correctly because
`useOverlayElements` collapses description to relativeY=0 when
`showLabels=false`, occupying the row layout already reserved. Added
regression test asserting bottomPx=27 for the
showLabels=false/showDescriptions=true case.

**~~Verify `subfeatureLabel.textWidth` always-counted intent.~~** _Done._
Existing comment at `rpcTypes.ts:165-176` already documents the
always-on intent ("subfeature labels always render"). No change needed.

**~~Make hit-test cache invalidation explicit.~~** _Done._ Added
`cachedBpPerPx` and `cachedReversed` fields to `FlatbushRegionCache`;
the cache now invalidates explicitly when either changes instead of
relying on `flatbushItems` reference identity. Defends against future
changes to layout that might preserve the array reference across a
bpPerPx change.

**Drop `regionStart` field; ship absolute genomic uint32.** Worker
output stores `rectPositions`/`linePositions`/`arrowXs` as offsets
relative to `regionStart`; consumers (4 shader uniforms,
`Canvas2DFeatureRenderer.ts:50,98,127`, `useOverlayElements.tsx:68`)
recombine. The offset trick exists for shader float32 precision, but
shaders already receive `bpStart` for the visible region — they can
subtract that themselves from absolute uint32 positions. Switching to
absolute brings canvas in line with the project-wide rule in
`CLAUDE.md` ("worker output is absolute genomic uint32"). Also delete
the stale doc comment in `RenderFeatureDataRPC/rpcTypes.ts:1-8`.
Medium-sized change; do on a dedicated branch with screenshot
verification. _Status: deferred — not started._

**Replace flatbushItem/subfeatureInfo shallow clones with offset
arrays — rejected approach.** `cloneMutableFields` in
`plugins/canvas/src/LinearBasicDisplay/layout.ts:86` shallow-clones
every flatbushItem and subfeatureInfo because `applyLayoutToRegion`
mutates `topPx`/`bottomPx`. The original idea: mirror the
rect/line/arrow Y pattern with a parallel `Float32Array` of offsets,
keep raw items immutable, read `item.topPx + offset` at consumer
sites.

_Tried and reverted (commit window 2026-04-25)._ Motivation: eliminate
N flatbushItem object allocations per layout pass. **Why it didn't
pay off in this scope:**

- The hot rendering loops (rect/line/arrow Y) already use `Float32Array`
  iteration. The clone allocations only matter for `flatbushItems` and
  `subfeatureInfos` (object arrays).
- `featureIdIndex`/`subfeatureIdIndex` (used for `selectedFeatureId`,
  `hoveredFeature`/`hoveredSubfeature`) and `featureItemMap` (in
  `FeatureComponent.tsx`) all consume `item.topPx`/`item.bottomPx`
  directly. Removing the mutation forces these to either (a) synthesize
  spread items `{ ...f, topPx: getFlatbushTopPx(data, i) }` — same
  allocation count, just shifted from `cloneMutableFields` to the
  index getter, or (b) refactor every consumer to indexed access with
  a `Map<featureId, index>`.
- (a) preserves only ~half the savings: 4-byte float entries replace
  ~80-byte spread objects, but allocation count is identical. (b) is
  the real win but cascades through `useOverlayElements` (~5 sites),
  `FeatureComponent.tsx`, `renderSvg.tsx`, `searchFeatureByID` return
  shape, and the `HitResult` shape returned by hit-test.

_Path to do this properly:_ commit to (b). Drop `topPx`/`bottomPx` from
`HitItemBase` entirely so the type system enforces the indexed-access
discipline. Then add `featureOffsets`/`featureLaidOutHeights`/
`subfeatureOffsets` Float32Arrays to `FeatureDataResult`, plus a
`getLaidOutFeature(data, i)` helper. Touching points:
`hitTesting.ts` (HitResult shape becomes
`{ data, featureIndex, subfeatureIndex }` instead of inline items),
`useOverlayElements.tsx` (FeatureItemEntry stores `{ data, index }`),
`baseModel.ts` (`featureIdIndex` becomes
`Map<featureId, { data, index }>`, `searchFeatureByID` resolves coords
from the data+index), `renderSvg.tsx`. Estimate: medium PR on a
dedicated branch, with attention to the LGV-facing
`searchFeatureByID` contract (returns
`[startBp, topPx, endBp, bottomPx]` to navigation code).

Skip until there's a measured perf signal — the current clone is O(N)
shallow object allocation per layout, which is dwarfed by GranularRect
packing for typical region sizes.

- **Alignments typed-array refactor.** Worker return shape is flat parallel arrays. Refactor into sub-objects by group: mods, sashimi, coverage (others TBD).

plugins/Canvas drawing text to canvas, does not look good. even if rasterized mode is on, draw text to svg unrasterized

Add 'synthetic whitespace' between tracks in exported svg

Remove logging like  [useGpuRenderer] factory rejected: Error: GPU crash when jest tests are run, mock console to swallow error. the tests are passing it is just a error diagnostic

Fix test errors in `pnpm jest plugins/`


## Breakpoint

- Closing tracks or something else to see if it works

## Check LDzip https://github.com/23andMe/LDZip
