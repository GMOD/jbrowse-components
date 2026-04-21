# JBrowse 2 WebGL/WebGPU Migration — Completed Items

Moved from PRD.md as items were finished.

---

## wiggle-core extraction — Phases 1 + 2 — COMPLETE

**Phase 1 — `packages/wiggle-core`:** `getNiceDomain`, `getScale`,
`getOrigin`, `makeScoreNormalizer`, `computeAutoscaleDomain` extracted to
`packages/wiggle-core/src/` (`scale.ts`, `normalize.ts`, `autoscale.ts`).
Added `domainFromStats(stats, autoscaleType, numStdDev)`. `plugins/wiggle/src/util.ts`
re-exports everything so no callers changed.

**Phase 2 — coverage stats in `packages/alignments-core`:** Added
`computeVisibleCoverageStats` + `computeGlobalCoverageStats` returning
`ScoreStats` from wiggle-core (single pass: min/max/sum/sumSq/count → mean
+ stdDev). Extended `computeCoverageTicks` with optional `scaleType`
(`'log'` uses log₂ y-positions and power-of-2 ticks). Added
`@jbrowse/wiggle-core` dep to alignments-core.

**Phase 3 — wire into `LinearAlignmentsDisplay`:** Added
`autoscale`/`minScore`/`maxScore`/`scaleType`/`numStdDev` to
`LinearAlignmentsDisplay` config schema. Added `coverageStats`,
`coverageDomain`, `coverageIsLog`, `coverageScaleType`, `coverageAutoscaleType`
getters. Updated `coverageTicks` to use domain + scaleType.
Updated `renderState.coverageMaxDepth` to use `coverageDomain[1]`.
Added setters `setCoverageScaleType`/`setCoverageAutoscaleType`/
`setCoverageMinScore`/`setCoverageMaxScore`. Exported `SetMinMaxDialog`
from `@jbrowse/plugin-wiggle`. Added "Coverage score" track menu with
Scale type / Autoscale type / Set min/max items. Added `@jbrowse/wiggle-core`
dep to alignments plugin.

---

## Dotplot — adopt shared MST autorun lifecycle — COMPLETE

`DotplotView/model.ts` now drives its lifecycle through
`self.startMultiRegionGpuLifecycle<DotplotBackend, DotplotRenderState>(...)`
and the open-coded `dotplotViewDrawAutorun` / `dotplotUploadAutorun` are gone.
Plan archived: `DOTPLOT_REFACTOR.md`.

---

## Synteny PR-B — view owns one canvas + backend — COMPLETE

`LinearSyntenyViewHelper/stateModelFactory.ts` and
`MultiLGVSyntenyDisplay/model.ts` both run through
`startMultiRegionGpuLifecycle` against the keyed `SyntenyBackend`
(`uploadGeometry(key, …)` / `deleteGeometry(key)`). `y_top` uniform and
per-track render state shipped with the shader changes. Plan archived:
`SYNTENY_REFACTOR_PR_B.md`.

---

## MismatchParser → packed NUMERIC_CIGAR — COMPLETE

`cigarToMismatches2.ts` and `mdToMismatches2.ts` operate directly on packed
`Uint32Array` from `@gmod/bam`, eliminating the string-parse step. Coverage
in `parseCigar2.test.ts`. Shipped in 808246bbb5.

---

## P5 dead-code sweep — COMPLETE (partial)

Removed from source: `uploadChangedRegions.ts`, `uploadRegionDataToGPU`,
`dataVersion` debug counter, `renderProps()` on GPU displays. `pruneRegionMap`
intentionally kept — still used by 8 backends.

---

## `FetchMixin` extraction + `displayedRegionIndex` rename — COMPLETE

Extracted `FetchMixin` from `MultiRegionDisplayMixin` into
`plugins/linear-genome-view/src/BaseLinearDisplay/models/FetchMixin.ts`.
The mixin owns `runFetch`, `cancelFetch`, `fetchSignal`, `isLoading`,
`error`, `statusMessage` — the entire cancel-safe fetch state machine.
`MultiRegionDisplayMixin` and `GlobalDataDisplayMixin` both compose it.
The old `withFetchLifecycle(needed, work)` method is replaced by
`self.runFetch(async ctx => { ... })`.

`regionNumber` renamed to `displayedRegionIndex` site-wide (~550 sites,
73 files) in the same commit.

---

## HiC + LDDisplay monolithic-fetch untracked elimination — COMPLETE

Created `GlobalDataDisplayMixin` (`plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalDataDisplayMixin.ts`) — canonical pattern for GPU displays that fetch one global dataset per viewport rather than per-region. Provides `withFetchLifecycle(work)` cancel-safe wrapper that owns token management, abort-exception swallowing, and `fetchGeneration` bump-on-complete. Both `plugins/hic/src/LinearHicDisplay/afterAttach.ts` and `plugins/variants/src/LDDisplay/afterAttach.ts` were refactored to use it, removing all `untracked` calls from those files. See ADR-007.

---

## plugins/dotplot UX — COMPLETE

- Added track selector button to dotplot header (`DotplotControls.tsx`), guarded
  by `isSessionModelWithWidgets`, matching the linear-genome-view pattern
- Increased wheel zoom speed: multiplier `1.03`/`0.97` → `1.07`/`0.935`
  (`useWheelHandler.ts`)

---

## P1.1 Canvas Fallback Rendering Backend — COMPLETE

All track types have Canvas 2D fallback renderers.

| Track Type            | Canvas 2D File                        | Status |
| --------------------- | ------------------------------------- | ------ |
| Alignments            | `Canvas2DAlignmentsRenderer.ts`       | Done   |
| Features              | `Canvas2DFeatureRenderer.ts`          | Done   |
| Wiggle / Multi-Wiggle | `Canvas2DWiggleRenderer.ts`           | Done   |
| HiC                   | `Canvas2DHicRenderer.ts`              | Done   |
| Dotplot               | `Canvas2DDotplotRenderer.ts`          | Done   |
| Variants              | `Canvas2DVariantRenderer.ts`          | Done   |
| Variant Matrix        | `Canvas2DVariantMatrixRenderer.ts`    | Done   |
| LD Display            | `Canvas2DLDRenderer.ts`               | Done   |
| Synteny               | `Canvas2DSyntenyRenderer.ts`          | Done   |
| Sequence              | Inline in `WebGPUSequenceRenderer.ts` | Done   |

All renderers respect `?gpu=off` / `getGpuOverride() === 'canvas2d'` and
auto-fall back: WebGPU → WebGL2 → Canvas 2D.

- Canvas 2D synteny picking (`pick()`) — implemented using `isPointInPath()`,
  iterates features in reverse draw order (top-most picked first), stores last
  render params for coordinate reconstruction
- Canvas 2D alignments renderer supports all 10 color schemes (normal, strand,
  mapping quality, insert size threshold, first-of-pair strand, pair
  orientation, insert size + orientation, modifications, tag-based)

---

## P1.2 Data Fetching / Redraw Reliability — COMPLETE

- Replaced `staticRegions` (legacy 800px-block-based) with viewport-based
  `mergedVisibleRegions` + explicit 50% buffer
- Wiggle tracks: integrated `isCacheValid()` for resolution-aware re-fetching on
  zoom-in; removed stale-region-based fetch
- `staticBlocks` kept for UI (scalebar/gridlines), but `staticRegions` removed
  from data fetching; replaced with direct viewport-based approach
- Fixed "1kg Human demo: the genes track triggers force load too soon" —
  replaced `maxFeatureCount=5000` with density-based `maxFeatureDensity=20`
  (features/pixel) throughout the stack (`rpcTypes.ts`,
  `executeRenderFeatureData.ts`, `LinearFeatureDisplay/model.ts`); also extended
  `ClearBlockingStateOnViewportChange` to clear `regionTooLarge` on viewport
  region change (not just zoom) by tracking `mergedVisibleRegions` key

---

## P2.1 Alignments Track — Completed Bugs

| Bug                                                           | Resolution                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color by per-base quality                                     | Colors reads by average base quality using HSL formula (same as MAPQ). Computed in `buildBaseFeatureData`, sent as `readAvgBaseQualities` Uint8Array. All 3 backends (WebGPU/WebGL/Canvas2D) + SVG export. Menu item "Base quality" added to color-by submenu. Legend shows BQ 0/10/20/30 gradient.              |
| Color by insert size (threshold vs gradient)                  | Both threshold (scheme 3) and gradient (scheme 10) implemented across all 3 backends + Canvas2D + SVG export. Gradient maps deviation from upper/lower thresholds to continuous blue→grey→red ramp. Menu item "Insert size (gradient)" added.                                                                    |
| Color by mapping quality — add legend                         | HSL gradient legend items added                                                                                                                                                                                                                                                                                  |
| Color by tag not working                                      | e2e test confirms two-phase fetch works (discover tags → re-fetch with colors). Canvas2D renderer now handles all 10 color schemes.                                                                                                                                                                              |
| Force load stuck                                              | `ClearBlockingStateOnViewportChange` clears on zoom or region change                                                                                                                                                                                                                                             |
| Wrong ratio shown over deletions in tooltip                   | Fixed                                                                                                                                                                                                                                                                                                            |
| Coverage interbase indicators conditional on total coverage   | `computeNoncovCoverage` uses per-position local depth (max of left/right neighbors) for indicator threshold; `MINIMUM_INDICATOR_READ_DEPTH` raised from 7→8; `computePositionFrequencies` + `applyDepthDependentThreshold` filter pileup interbase features by depth-dependent frequency; 27 unit tests          |
| Non-intron rendered on sidescroll weirdly for iso-seq         | Root cause was stencil buffer state leaking between displayedRegions. Stencil pass completely removed (commits 88d7e42b, d299f989). Gaps now rendered directly with proper skip/deletion coloring without stencil.                                                                                               |
| WebGL 2.0 mismatch colors when zoomed out                     | `CoverageRenderer` disabled `gl.BLEND` after drawing indicators; fix: re-enable `gl.BLEND` at start of `PileupRenderer.render()`.                                                                                                                                                                                |
| volvox-long reads with SV not rendering when zoomed out       | `checkByteEstimate` now uses the adapter's `fetchSizeLimit` (BAM=5MB, CRAM=3MB) via `Math.max(adapterLimit, displayLimit)`. Also added `isLoading` guard (via `untracked`) to prevent duplicate byte-estimate RPC calls.                                                                                         |
| Insertion depth weird                                         | Fixed                                                                                                                                                                                                                                                                                                            |
| Draw outline even when compact                                | Size threshold lowered from 4px to 2px                                                                                                                                                                                                                                                                           |
| Linked read mode not wired up                                 | `setShowLinkedReads()` was missing `invalidateLoadedRegions()` call. Added invalidation at end of toggle action.                                                                                                                                                                                                 |
| Read vs ref synteny view not working                          | `LinearReadVsRef` menu registration was checking for `'LinearPileupDisplay'` (old name) instead of `'LinearAlignmentsDisplay'`. Menu item never appeared.                                                                                                                                                        |
| Sort modifications — last color by option                     | Moved to end of color-by submenu                                                                                                                                                                                                                                                                                 |
| Put arc color scheme in color by                              | Already present as submenu in color-by menu                                                                                                                                                                                                                                                                      |
| Bad triangle interbase indicators                             | Added barycentric-coordinate anti-aliasing to both WebGL (GLSL) and WebGPU (WGSL) indicator triangle shaders; enabled alpha blending for WebGL indicator draw pass                                                                                                                                               |
| Click sashimi — make it look selected (selected color arc)    | Selected arc renders with dark stroke (#333) and thicker width; click toggles selection                                                                                                                                                                                                                          |
| Unmapped mate coloring collides with other pink               | Flag 8 check for unmapped mate precedes insert size / pair orientation coloring in all 3 backends + Canvas2D. Brown (#8B4513) is visually distinct from short-insert pink.                                                                                                                                       |
| Hide insertions in low coverage when region has high coverage | `computePositionFrequencies` uses interbase depth (max of neighbors); `applyDepthDependentThreshold` with `featureFrequencyThreshold()` zeroes low-frequency insertions; shader fades zeroed-frequency features via sub-pixel alpha                                                                              |
| Reset mouseover after change link mode                        | Clears featureIdUnderMouse/highlightedChainIds on toggle                                                                                                                                                                                                                                                         |
| WebGL arcs not vibrant                                        | Premultiplied alpha fix in arc/sashimi WGSL shaders                                                                                                                                                                                                                                                              |
| GPU mismatches render without backing read rectangles         | `buildSegmentArrays` was clipping segment end positions at `windowEnd` but `buildMismatchArrays` had no upper bound. Fix: removed the `windowEnd` clipping from `buildSegmentArrays` so segments extend to the full feature end, matching `readPositions`. Updated 4 unit tests in `buildSegmentArrays.test.ts`. |
| Outline on alignments shift+scroll                            | Fixed — verified working in browser                                                                                                                                                                                                                                                                              |

---

## P2.2 Wiggle Track — Completed Bugs

| Bug                                         | Resolution                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cross hatches                               | `displayCrossHatches` toggle + SVG overlay                                                                                                                                                                                                                                                                                                 |
| Multi-wiggle color with overlapping modes   | Row index used `idx` from `orderedSources.entries()` which skipped values when sources had no RPC data; replaced with separate `rowCounter` that increments only for sources with data                                                                                                                                                     |
| Refresh after multi-wiggle fails also fails | Root cause: `ready` state wasn't reset on retry. Canvas unmounted during error, recreated on retry with new DOM element. But useEffect deps `[model, ready]` didn't change (ready stayed `true`), so data upload autoruns never re-attached. Fix: reset `ready`/`drawn`/`error` state on retry in both single and multi-wiggle components. |
| Color change wiggle not working (sometimes) | Investigated — e2e test (`wiggle-color.ts`) proves autorun correctly re-fires on color change.                                                                                                                                                                                                                                             |

---

## P2.3 Synteny / Comparative Views — Completed Bugs

| Bug                                                                 | Resolution                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hs1 vs mm39 synteny — excessively slow, causes freeze               | Improved — added viewport culling in `executeSyntenyFeaturesAndPositions.ts`: features where BOTH view projections are entirely off-screen (with 50% buffer) are skipped. For genomes with many chromosomes, this can eliminate 50-90% of features. Further LOD improvements possible. |
| Yeast synteny — error when splitting                                | `renameIds()` in `copyView.ts` was concatenating old+new IDs (`${val}-${newId}`), which could break MST `types.identifier` uniqueness. Now uses the new ID directly.                                                                                                                   |
| Multi-way synteny (grape/peach/cacao) — synteny tracks fail to load | `init.tracks` now supports 2D array `string[][]` for explicit per-level track assignment. `LaunchLinearSyntenyView` passes through the structure. Backwards compatible with flat `string[]` (all go to level 0).                                                                       |
| Color dotplot red vs black                                          | Done                                                                                                                                                                                                                                                                                   |
| Make scrolling dotplot a little slower                              | Doubled scroll divisors in `useWheelHandler.ts` (horizontal `/5`→`/10`, vertical `/15`→`/30`)                                                                                                                                                                                          |
| Horizontally flipped stuff is inaccurate                            | Not a bug — strand swap + reversed region double-flip is correct behavior (unit tests confirm all 4 strand×reversed combinations). Blank snapshots were due to missing `drawn-` signal (now fixed).                                                                                    |

---

## P2.4 SVG Export Issues — COMPLETE

| Bug                                                           | Resolution                                                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Y scale bars wrong in multi-wiggle (no scalebar label offset) | Removed — offset not desired for multi-row mode                                                                                                  |
| Monospace font on sequence track                              | Added `font-family="monospace"` to both `renderBaseLetters()` and `renderTranslationLetters()` in sequence SVG export                            |
| Monospace font on peptides                                    | Added `font-family="monospace"` to `renderPeptideLettersForRegion()` in feature SVG export                                                       |
| Alignments SVG: indels too visible in SKBR3 output            | Likely fixed — depth-dependent frequency thresholds and sub-pixel alpha fading now applied consistently across SVG, Canvas2D, and GPU renderers. |

---

## P2.5 Variant Track — Completed Bugs

| Bug                                              | Resolution                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Toggling between matrix and non-matrix modes     | Not a bug — works as expected                                                                                                                    |
| Clicking multisample variant — not enough detail | Click handler now enriches simplified feature with REF, ALT, description, genotypes, and clicked sample info from featureGenotypeMap/featureData |

---

## P3.1 Canvas/Interaction — Completed Bugs

- After zoom, features reposition but mouseover shading stuck — hover state
  (hoveredFeature, hoveredSubfeature, featureIdUnderMouse) now cleared when new
  RPC data is uploaded in FeatureComponent
- Labels disappear during zoom — description labels now always included in RPC
  response (not gated by `showDescriptions`); layout always reserves space;
  visibility filtered client-side by `effectiveShowDescriptions`
- Infinite loop after error in multi-wiggle — Added try/catch + `isAlive` guard
  to `VisibleScoreRange` autorun in multi-wiggle `afterAttach`; prevents
  `getContainingView` crash from causing infinite autorun re-trigger

---

## P3.4 Methylation / Modifications — Completed Bugs

- Color by reference CpG not working — off-by-one in `extractMethylation()`: CpG
  detection was checking `rSeq[j - refStart + 1]` instead of
  `rSeq[j - refStart]`, missing all real CpG sites. Added 4 unit tests.

---

## Resolved "Unclear" Items

- **Force load "slightly stuck"** — `ClearBlockingStateOnViewportChange` now
  clears on zoom OR region change (tracks `mergedVisibleRegions` key);
  density-based threshold (`maxFeatureDensity=20` features/px) replaces absolute
  `maxFeatureCount=5000`; "force load" button triples the density limit.
- **Color change wiggle "sometimes" not working** — e2e test (`wiggle-color.ts`)
  proves autorun correctly re-fires on color change. If issue recurs, debug
  logging can be re-added.

---

## Recent Changes Log

### 2026-03-15

**Interbase Indicator Depth Threshold Fix**

- `MINIMUM_INDICATOR_READ_DEPTH` raised from 7→8 so no indicators appear at low
  coverage (<8 reads)
- Fixed inconsistency: `localDepth > 7` (hardcoded) →
  `localDepth >= MINIMUM_INDICATOR_READ_DEPTH` (uses constant)
- Added 20 unit tests for `computeNoncovCoverage` indicators,
  `computePositionFrequencies`, `applyDepthDependentThreshold`, and
  `featureFrequencyThreshold`

**Labels Disappear During Zoom Fix**

- `createFeatureFloatingLabels()` no longer gates description label on
  `showDescriptions` config — descriptions always included in RPC response
- `applyLabelDimensions()` always reserves layout height for descriptions (not
  gated by `showDescriptions`)
- Client-side filtering in `FeatureComponent.tsx`
  (`model.effectiveShowDescriptions`) unchanged — controls visibility at render
  time
- Added regression test verifying label data stability across simulated zoom
  levels

### 2026-03-14

**Canvas2D Alignments: Full Color Scheme Support**

The `Canvas2DAlignmentsRenderer` now implements all 10 color schemes via a
`switch` on `colorScheme`:

- 0: Normal (supplementary in orange, else strand)
- 1: Strand (fwd/rev/nostrand)
- 2: Mapping quality (HSL hue from mapq)
- 3: Insert size (threshold-based: long/short/normal)
- 4: First-of-pair strand
- 5: Pair orientation (LR/RL/RR/LL)
- 6: Insert size + orientation (combined)
- 7: Modifications (fwd/rev tint)
- 8: Tag-based (RGB from `readTagColors`)

Added `hslToRgb()` helper for mapping quality rendering.

**Density-Based Feature Limits**

Replaced absolute `maxFeatureCount=5000` with `maxFeatureDensity=20` (features
per pixel). The RPC handler now computes
`featureDensity = featuresArray.length / regionWidthPx` and only triggers
"region too large" when density exceeds the limit. This means the 1000 Genomes
human genes track no longer triggers force-load prematurely at reasonable zoom
levels.

**Viewport-Aware Error Recovery**

`ClearBlockingStateOnViewportChange` autorun now tracks both `bpPerPx` and a
`mergedVisibleRegions` key. Panning to a new chromosome or region clears
`regionTooLarge`/`error` state, not just zooming.

**Canvas2D Synteny Picking**

Implemented `pick()` in `Canvas2DSyntenyRenderer` using `isPointInPath()`.
Stores last render parameters (offsets, scales, bpPerPx) and iterates features
in reverse draw order so top-most features are picked first. Handles both
straight parallelograms and curved features. Added 7 new unit tests for picking.

**Synteny Browser Test Fix**

Added `drawn-${drawn}` data-testid to the synteny rendering component wrapper
div. Previously, synteny browser tests captured blank white snapshots because
`waitForCanvasRendered` had no way to detect when synteny data was loaded and
rendered (no loading overlay, no drawn signal).

**Error Handling Improvements**

- Synteny draw autorun: added try/catch around rendering operations that sets
  `model.error` on failure
- Synteny rendering component: added `ErrorMessage` display when `model.error`
  is set
- Previously errors were `setError()`'d but never rendered in the synteny UI

**Yeast Synteny Split Fix**

Fixed `renameIds()` in `copyView.ts` — was concatenating `${oldId}-${newId}`
which could break MST `types.identifier` uniqueness in synteny's nested `levels`
array. Now uses the generated ID directly.

**Strand Swap Coordinate Tests**

Added 4 unit tests verifying synteny parallelogram crossing behavior for all
strand×reversed combinations. Confirmed that the double-flip (strand=-1 +
reversed region) producing parallel lines is the correct biological behavior.

**Debug Logging**

- Alignments model: logs tag color discovery and re-fetch triggers
  (`[alignments]` prefix)
- Browser test runner: forwards `[alignments]` console messages alongside
  existing `[webgl-wiggle]` messages

---

## P1.4 Demo Session Loading — Snapshot Migration

Added testable migration utilities for loading old sessions and configs:

- **`migrateWiggleSnapshot`** (17 tests) — migrates old `SharedWiggleMixin`
  property names (`scale` → `scaleTypeSetting`, `autoscale` →
  `autoscaleSetting`, `rendererTypeNameState` → `renderingTypeSetting`,
  `constraints.{min,max}` → `minScoreSetting`/`maxScoreSetting`, color
  properties, `showSidebar` → `showTreeSetting`). Strips removed properties
  (`fill`, `minSize`). Handles `xyplot` → `multixyplot` remap for multi-wiggle.
- **`migrateAlignmentsSnapshot`** (15 tests) — remaps old display types
  (`LinearPileupDisplay`, `LinearReadArcsDisplay`, `LinearReadCloudDisplay`,
  `LinearSNPCoverageDisplay` → `LinearAlignmentsDisplay`), migrates
  `renderingMode` → `showLinkedReads`, nested
  `PileupDisplay`/`SNPCoverageDisplay` sub-display format, `height` →
  `heightPreConfig`.
- **`migrateSessionSnapshot` / `migrateConfigSnapshot`** (17 tests) —
  recursively walks session snapshots (views → tracks → displays) and config
  snapshots (tracks → displays) to remap old display types.
- Wired into `createPluginManager.ts` (sessions), `jbrowseModel.ts` (configs),
  and display `preProcessSnapshot` hooks.
- Test configs updated: `LinearPileupDisplay`/`LinearSNPCoverageDisplay` →
  `LinearAlignmentsDisplay` in all `test_data/volvox/` files.

---

## Effective Track Config / Copy Config Enhancement

Added `effectiveTrackConfig` getter to display models so "Copy config" in the
About track dialog includes user-modified display settings:

- **`getEffectiveTrackConfig()`** utility (8 tests) — iterates display config
  slots, compares stored config values against display model getters, produces a
  track config snapshot with overrides baked in. No mutation.
- **`BaseDisplay.effectiveTrackConfig`** — default getter returns raw track
  config snapshot.
- **`LinearWiggleDisplay`**, **`MultiLinearWiggleDisplay`**,
  **`LinearAlignmentsDisplay`** — override getter using the utility to include
  session overrides (color, scale type, autoscale, rendering type, etc.).
- **`BaseTrackModel.activeDisplay`** — formalizes `displays[0]` as the active
  display.
- **`TrackLabelMenu`** — passes `effectiveTrackConfig` to
  `getTrackActionMenuItems` which forwards it to the About dialog.
- Integration tests (6 tests) verify override inclusion, track property
  preservation, and cross-display-type behavior.

---

## 2026-04-20 Housekeeping

**Tab visibility → HAL — COMPLETE**

All three remaining call sites that used `useTabVisibilityRerender` + `renderNow`
directly (`LevelSyntenyCanvas.tsx`, `MultiSyntenyRendering.tsx`,
`DotplotView.tsx`) replaced with `useGpuModelLifecycle`. Dropped unused `gpuOpts`
memos and backend type imports. `useTabVisibilityRerender` un-exported from
`@jbrowse/core/util/index.ts` — now an internal detail of `useGpuModelLifecycle`
only.

**Pileup read hit detection root cause identified + fixed**

`hitTesting.ts` checks `readYs[i] !== row` to match cursor row, but
`resolveBlockForCanvasX` in `useAlignmentsBase.ts` was reading from `rpcDataMap`
whose `readYs` are all zeros until main-thread layout runs. Fixed by switching
`resolveBlockForCanvasX` to read from `laidOutPileupMap` (which has real Y arrays
from the derived-layout pass). Also removed stale `rpcDataMap` entry from the
`LinearAlignmentsDisplayModel` duck-typed interface. Needs browser verification.

---

## 2026-04-19 Housekeeping

**Dead code sweep — `setCanvasDrawn`**

`setCanvasDrawn(val)` was declared in two component interfaces but never called
(removed from `GpuBackendLifecycleSlotMixin` in an earlier refactor). Removed
from `useAlignmentsBase.ts`, `buildSourceRenderData.ts`, and the
`WiggleComponent.test.ts` mock object.

**MultiRegionDisplayMixin `untracked` documentation**

All three load-bearing `untracked` calls in `MultiRegionDisplayMixin.ts` now
have `// Why:` comments:
- `isLoading` — prevents re-trigger cycle
- `loadedRegions` — avoids redundant fetch check when data arrives
- `regionTooLarge/error` — clears only on viewport change, not when set

**Y-scalebar nice tick labels**

`computeCoverageTicks` (`packages/alignments-core/src/coverageDownsampling.ts`)
now uses a `niceStep` function that rounds to 1/2/5×10ⁿ — producing labels like
0, 50, 100 instead of 0, 33, 67, 100. Short height (<70px): 0 and max only.
Tall height: step-aligned ticks from 0 to `floor(maxDepth/step)*step`.
Tests updated to assert on specific nice values.

**Paired arcs visibility** (committed 808246bbb5)

Upward-pointing arcs (pairedArcsDown=false) were rendering at wrong height
because `arc.slang` subtracted `u.covOffset` (coverage strip height) from
`availH`, shrinking arc headroom. Removed the subtraction; arc baseline now
aligns with the visual bottom of coverage bars.

**`mergedVisibleRegions` removal**

`mergedVisibleRegions` was a computed getter on `LinearGenomeViewModel` that
iterated `dynamicBlocks.contentBlocks` and built a `Map` keying blocks by
`displayedRegionIndex`, merging coordinates with `min(start)/max(end)`.

Investigation showed the merge branch is dead code: `calculateDynamicBlocks`
iterates once per `displayedRegions` entry and produces at most one
`ContentBlock` per `displayedRegionIndex` (via a single `intersection2` call).
Multiple blocks per index only occur in `calculateStaticBlocks` (which
subdivides regions into fixed-size tiles for the scalebar UI), but
`mergedVisibleRegions` read from `dynamicBlocks`, not `staticBlocks`.

Removed `mergedVisibleRegions` entirely. All six call sites updated to use
`view.visibleRegions` directly (which is just `dynamicBlocks.contentBlocks`
mapped to include pixel fields). `bufferedVisibleRegions` updated to derive
from `visibleRegions` with `Math.floor`/`Math.ceil` on the buffer arithmetic.
The dead `void r.refName` / `void r.displayedRegionIndex` loops in
`ClearBlockingStateOnViewportChange` replaced with `void view.visibleRegions`.
