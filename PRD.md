# JBrowse 2 WebGL/WebGPU Migration — Project Requirements Document

**Branch:** `webgl-poc`
**Last updated:** 2026-03-14
**Status:** Active development — many features working, significant polish and testing needed

---

## Executive Summary

JBrowse 2 is being migrated from its block-based HTML canvas rendering to a unified GPU-accelerated rendering pipeline supporting three backends: **WebGPU**, **WebGL 2.0**, and **HTML5 Canvas** (fallback + SVG export). The branch has working implementations for most track types with known bugs and gaps documented below.

---

## Priority 1 — Critical / Blocking

These issues block production readiness or affect the majority of users.

### P1.1 Canvas Fallback Rendering Backend — COMPLETE

**Status:** All track types now have Canvas 2D fallback renderers.

| Track Type | Canvas 2D File | Status |
|---|---|---|
| Alignments | `Canvas2DAlignmentsRenderer.ts` | Done |
| Features | `Canvas2DFeatureRenderer.ts` | Done |
| Wiggle / Multi-Wiggle | `Canvas2DWiggleRenderer.ts` | Done |
| HiC | `Canvas2DHicRenderer.ts` | Done |
| Dotplot | `Canvas2DDotplotRenderer.ts` | Done |
| Variants | `Canvas2DVariantRenderer.ts` | Done |
| Variant Matrix | `Canvas2DVariantMatrixRenderer.ts` | Done |
| LD Display | `Canvas2DLDRenderer.ts` | Done |
| Synteny | `Canvas2DSyntenyRenderer.ts` | Done |
| Sequence | Inline in `WebGPUSequenceRenderer.ts` | Done |

All renderers respect `?gpu=off` / `getGpuOverride() === 'canvas2d'` and auto-fall back: WebGPU → WebGL2 → Canvas 2D.

**Remaining polish:**
- ~~Canvas 2D synteny picking (`pick()`) returns -1~~ **DONE** — implemented using `isPointInPath()`, iterates features in reverse draw order (top-most picked first), stores last render params for coordinate reconstruction
- Canvas 2D LD renderer does nearest-neighbor color ramp sampling (no interpolation like GPU)
- Canvas 2D alignments renderer now supports all 9 color schemes (normal, strand, mapping quality, insert size threshold, first-of-pair strand, pair orientation, insert size + orientation, modifications, tag-based)

### P1.2 Data Fetching / Redraw Reliability

**Why:** Core usability — users zoom out on alignments tracks and the view doesn't redraw. This makes the app appear broken.

**Requirements:**
- ~~Debug re-requests to ensure data is fetched for the entire visible region~~ **DONE** — replaced `staticRegions` (legacy 800px-block-based) with viewport-based `mergedVisibleRegions` + explicit 50% buffer
- ~~Audit wiggle tracks: "not fetching data in entire visible region sometimes"~~ **DONE** — integrated `isCacheValid()` for resolution-aware re-fetching on zoom-in; removed stale-region-based fetch
- ~~Investigate `staticBlocks` usage and whether it's still needed~~ **DONE** — `staticBlocks` kept for UI (scalebar/gridlines), but `staticRegions` removed from data fetching; replaced with direct viewport-based approach
- ~~Fix: "1kg Human demo: the genes track triggers force load too soon"~~ **DONE** — replaced `maxFeatureCount=5000` with density-based `maxFeatureDensity=20` (features/pixel) throughout the stack (`rpcTypes.ts`, `executeRenderFeatureData.ts`, `LinearFeatureDisplay/model.ts`); also extended `ClearBlockingStateOnViewportChange` to clear `regionTooLarge` on viewport region change (not just zoom) by tracking `mergedVisibleRegions` key

### P1.3 Expand Browser Test Suite

**Why:** Need confidence that changes don't regress across backends. Current suite has 14 test files but many features/demos are untested.

**Requirements:**
- WebGPU does not work on CI action runners — tests must work with WebGL and Canvas fallback
- Add puppeteer screenshot tests covering all demo/gallery URLs listed in the demo inventory below
- Compare whole-page screenshots (block-based comparison from `origin/main` doesn't apply here)
- Tests should be runnable against both `origin/main` and `webgl-poc` branch for comparison
- Existing infrastructure: `browser-tests/runner.ts`, `snapshot.ts` with pixelmatch, `compare-backends.ts`

### P1.4 Demo Session Loading

**Why:** Many shared session links fail to load or load with incorrect settings. This is the primary way users encounter the app.

**Requirements:**
- Audit all demo/gallery URLs (see inventory below) and fix session loading errors
- Ensure `types.refinement` from MST v5.6.0 provides fallbacks when state tree fails to load
- Map all old "renderer" concepts to new display model settings
- Ensure all demo sessions load without error

---

## Priority 2 — High / Major Feature Gaps

These affect significant user-visible functionality.

### P2.1 Alignments Track Bugs

| Bug | Notes |
|-----|-------|
| Color by per-base quality | Not implemented (requires new RPC data extraction) |
| Color by insert size (threshold vs gradient) | **Threshold DONE** (all 3 backends + Canvas2D). Gradient mode not yet implemented for reads (exists for arcs only) |
| Color by mapping quality — add legend | **DONE** — HSL gradient legend items added |
| Color by tag not working | **DONE** — e2e test confirms two-phase fetch works (discover tags → re-fetch with colors). Canvas2D renderer now handles all 9 color schemes (normal, strand, mapq, insert-size, first-of-pair, pair-orientation, insert+orientation, modifications, tag). |
| Color orange for supplementary reads | Already implemented in normal color scheme (all 3 backends) — verify other color modes |
| Force load stuck | **DONE** — `ClearBlockingStateOnViewportChange` clears on zoom or region change |
| Wrong ratio shown over deletions in tooltip | |
| Coverage interbase indicators conditional on total coverage | |
| Non-intron rendered on sidescroll weirdly for iso-seq | |
| volvox-long reads with SV not rendering when zoomed out | **FIXED** — `checkByteEstimate` now uses the adapter's `fetchSizeLimit` (BAM=5MB, CRAM=3MB) via `Math.max(adapterLimit, displayLimit)`, matching `FeatureDensityMixin.maxAllowableBytes` chain. Previously only used display config default (1MB). Also added `isLoading` guard (via `untracked`) to prevent duplicate byte-estimate RPC calls from concurrent autorun firings. |
| Insertion depth weird | |
| Draw outline even when compact | **DONE** — size threshold lowered from 4px to 2px |
| Linked read mode not wired up | Investigated — wiring is correct (invalidation autorun, RPC dispatch, migration). Demo #15 uses encrypted share link so can't inspect snapshot directly. Need to test in browser. |
| Read vs ref synteny view not working | Observed in SKBR3 PacBio demo |
| Sort modifications — last color by option | |
| Put arc color scheme in color by | |
| Bad triangle interbase indicators | **FIXED** — added barycentric-coordinate anti-aliasing to both WebGL (GLSL) and WebGPU (WGSL) indicator triangle shaders; enabled alpha blending for WebGL indicator draw pass |
| Outline on alignments shift+scroll | |
| Click sashimi — make it look selected (selected color arc) | **DONE** — selected arc renders with dark stroke (#333) and thicker width; click toggles selection |
| Unmapped mate coloring collides with other pink | |
| Hide insertions in low coverage when region has high coverage | |
| Reset mouseover after change link mode | **DONE** — clears featureIdUnderMouse/highlightedChainIds on toggle |
| WebGL arcs not vibrant | **DONE** — premultiplied alpha fix in arc/sashimi WGSL shaders |
| Clicking chain — get both feature info | |

### P2.2 Wiggle Track Bugs

| Bug | Notes |
|-----|-------|
| Color change wiggle not working (sometimes) | Investigated — e2e test proves reactivity works; autorun correctly re-fires on color change |
| Cross hatches | **DONE** — `displayCrossHatches` toggle + SVG overlay |
| Multi-wiggle color with overlapping modes | **FIXED** — row index used `idx` from `orderedSources.entries()` which skipped values when sources had no RPC data; replaced with separate `rowCounter` that increments only for sources with data |
| Overlapping line whiskers | Single color whiskers option? |
| Y-scale bar offset per row | Unclear repro |
| Refresh after multi-wiggle fails also fails | Investigated — error state clearing in `reload()` looks correct (calls `setError(null)` + `clearAllRpcData()` which also clears error). The `MultiWiggleComponent` has dual error state (React `useState` + `model.error`), both cleared on retry. May be a GPU renderer state issue — renderer initialized in a `useEffect` that only runs once, so if GPU context is lost during an error, retry might not re-init the renderer. Needs browser testing. |
| Density vs XYPlot mismatch between sidebar and SVG export | Investigated — code analysis shows sidebar, main display, and SVG export all read from same `model.renderingType` getter. Cannot reproduce from code. |
| Sidebar legend toggle distinct from tree sidebar | |
| **UNCLEAR:** Brief tooltip flash in top left on wiggle-multi | Needs investigation |

### P2.3 Synteny / Comparative Views

| Bug | Notes |
|-----|-------|
| Hs1 vs mm39 synteny — excessively slow, causes freeze | **IMPROVED** — added viewport culling in `executeSyntenyFeaturesAndPositions.ts`: features where BOTH view projections are entirely off-screen (with 50% buffer) are skipped before instance generation and GPU upload. Debug log shows cull ratio. For genomes with many chromosomes, this can eliminate 50-90% of features. Further LOD improvements possible. |
| Yeast synteny — error when splitting | **FIXED** — `renameIds()` in `copyView.ts` was concatenating old+new IDs (`${val}-${newId}`), which could break MST `types.identifier` uniqueness. Now uses the new ID directly. |
| Multi-way synteny (grape/peach/cacao) — synteny tracks fail to load | **FIXED** — `init.tracks` now supports 2D array `string[][]` for explicit per-level track assignment. `LaunchLinearSyntenyView` passes through the structure. Backwards compatible with flat `string[]` (all go to level 0). |
| Zoom to full not working? | **UNCLEAR** — needs verification |
| Don't colorize indels not working? | **UNCLEAR** — needs verification |
| Split indels code | Refactoring task |
| Horizontally flipped stuff is inaccurate | Investigated — strand swap + reversed region double-flip is actually correct behavior (two flips cancel for inversions). The real issue was blank synteny browser test snapshots due to missing `drawn-` signal (**now fixed**). Need to re-run browser tests with the `drawn-` fix to verify actual rendering. Added unit tests confirming coordinate math for all 4 strand×reversed combinations. |
| Color dotplot red vs black | |
| Make scrolling dotplot a little slower | **DONE** — doubled scroll divisors in `useWheelHandler.ts` (horizontal `/5`→`/10`, vertical `/15`→`/30`) |
| Linked dotplot and synteny view | Idea / future feature |
| Swap axes dotplot | Idea / future feature |
| Swap axes linear synteny view | Idea / future feature |

### P2.4 SVG Export Issues

| Bug | Notes |
|-----|-------|
| Y scale bars wrong in multi-wiggle (no scalebar label offset) | Also check in main app |
| Monospace font on sequence track | **FIXED** — added `font-family="monospace"` to both `renderBaseLetters()` and `renderTranslationLetters()` in sequence SVG export |
| Monospace font on peptides | **FIXED** — added `font-family="monospace"` to `renderPeptideLettersForRegion()` in feature SVG export |
| Alignments SVG: indels too visible in SKBR3 output | |

### P2.5 Variant Track Issues

| Bug | Notes |
|-----|-------|
| Toggling between matrix and non-matrix modes | Investigated — two separate display types (`MultiLinearVariantDisplay` vs `LinearVariantMatrixDisplay`) share `MultiSampleVariantBaseModel`. The `cellDataMode` getter drives different RPC modes. Issue may be that display type switch doesn't properly re-trigger `getVariantCellDataAutorun`, or phased layout/clusterTree state persists incompatibly across mode switches. |
| Clicking multisample variant — not enough detail | |
| Tetraploid potato — maybe failed to load matrix | |
| Human trio phased VCF rendering | Needs verification |

---

## Priority 3 — Medium / Polish

### P3.1 Canvas/Interaction Bugs

- ~~After zoom, features reposition but mouseover shading stuck~~ **FIXED** — hover state (hoveredFeature, hoveredSubfeature, featureIdUnderMouse) now cleared when new RPC data is uploaded in FeatureComponent
- Labels disappear during zoom
- Hot module reload breaks canvas features
- Per-track scrolling — verify working
- After fatal error: `Uncaught Error: no containing view found` in `getContainingView`
- Infinite loop after error in multi-wiggle (check others too)
- Closing track errors (non-webgl bug)
- Dockview move to right side of screen not working (non-webgl bug)

### P3.2 Breakpoint Split View

- Overlay can show when forceload visible
- Inversion example: tracks moved around in view may have bugs
- Hybrid long read breakpoint split view display (following read chain path)

### P3.3 Non-WebGL Bugs

- Diagonalization: yeast works, grape vs peach unclear
- Opening reference sequence track with `umd_plugin.js` gives `TypeError: Cannot assign to read only property 'metadata'` — need to handle frozen objects from extension points
- Small white block in sequence track

### P3.4 Methylation / Modifications

- Color by reference CpG not working (should show blue over orange for hypomethylated)
- ENCODE multi-bigwig example: settings from snapshot not properly loaded
- COLO829 melanoma multi-bigwig: settings not properly loaded

---

## Priority 4 — Low / Future Enhancements

### P4.1 Performance Analysis

- Analyze how fetching and layout works across track types
- Extract commonality between renderers
- Write architecture documentation

### P4.2 R/ggplot2 Export System

**Status:** Very ambitious, branch exists with initial work.

- Design system to export session to R code generating ggplot images
- Generic WebGL + ggplot2 system (very speculative)
- Needs significant planning before implementation

### P4.3 Type Safety Improvements

- Utilize `types.refinement` from MST v5.6.0 for fallbacks
- Add tests for `types.refinement` usage
- Ensure all old renderer concepts mapped to new display model settings

### P4.4 UI/UX Ideas (Unscoped)

- Should not shrink size on linked read resize height
- Add ability where resize height does actual resize
- Resize on double-click resize handle
- Drag entire view to resize
- Click isoform to expand all
- Global scrollZoom setting rather than per view
- Rolling average line plot
- Zarr VCF support
- Add legend for alignments
- Distinguish initialized concepts in linear genome view

---

## Demo Inventory

Status key: **Working**, **Partial** (loads with issues), **Broken** (fails to load or unusable)

| # | Demo | Status | Notes |
|---|------|--------|-------|
| 1 | Volvox (genes, sequence, variants, multi-wiggle) | Working | |
| 2 | SARS-CoV2 | Working | Occasional label collision |
| 3 | Breakpoint split view | Working | Nice scroll zoom |
| 4 | Dotplot (grape vs peach) | Working | Smooth scroll zoom |
| 5 | Synteny (grape vs peach) | Working | |
| 6 | Hs1 vs mm39 synteny | Broken | Excessively slow, freezes |
| 7 | Yeast synteny | Working | Error when splitting fixed (renameIds concatenation bug) |
| 8 | Human HG002 insertion | Working | |
| 9 | SKBR3 breakpoint split view | Working | |
| 10 | Nanopore methylation/modifications | Working | |
| 11 | 1000 genomes extended trio | Working | |
| 12 | ENCODE multi-bigwig | Working | |
| 13 | COLO829 melanoma multi-bigwig | Working | |
| 14 | Inversion (single row BSV) | Working | Track move bug noted |
| 15 | Inversion (linked reads) | Broken | Snapshot fails, wrong visualization |
| 16 | Multi-way synteny (grape/peach/cacao) | Partial | Session-spec init fixed (per-level tracks). Shared session link may need level migration. |
| 17 | Tetraploid potato multi-sample VCF | Partial | Matrix may fail to load |
| 18 | Human trio phased VCF | Working | |
| 19 | Hi-C contact matrix | Working | |
| 20 | Horizontally flip demo | Broken | Flipped positions inaccurate |
| 21 | COLO829 melanoma coverage | Partial | Settings not loaded from snapshot |
| 22 | GIAB heterozygous deletion | Working | Color by tag now working (all 9 color schemes in Canvas2D) |
| 23 | SKBR3 PacBio read vs ref | Partial | Read vs ref synteny broken |
| 24 | CpG methylation nanopore | Partial | Color by reference CpG broken |
| 25 | 1000 genomes SV large inversion | Broken | Not yet working |

**Working: 14 | Partial: 4 | Broken: 5 | Untested: 2**

---

## Architecture Notes

### Current Rendering Backends

```
┌─────────────────────────────────────────────┐
│            Track Display Model              │
│         (prepares data, layout)             │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
┌────────┐  ┌────────┐  ┌────────────┐
│ WebGPU │  │WebGL2  │  │ Canvas 2D  │ ← COMPLETE (all track types)
│ (WGSL) │  │(GLSL)  │  │ (fallback) │
└────────┘  └────────┘  └────────────┘
                              │
                         ┌────┴────┐
                         ▼         ▼
                    ┌────────┐ ┌───────┐
                    │ Screen │ │  SVG  │ (via SvgCanvas.ts)
                    └────────┘ │Export │
                               └───────┘
```

### Backend Selection

- `?gpu=webgpu` — force WebGPU
- `?gpu=webgl` — force WebGL2
- `?gpu=off` — disable GPU (will use Canvas 2D fallback when P1.1 complete)
- Default: auto-detect (WebGPU → WebGL2 → Canvas 2D)

### Test Infrastructure

- Puppeteer-based browser tests in `products/jbrowse-web/browser-tests/`
- **21 test suites** with **~105 test cases** covering: alignments, bigwig, variants, synteny, dotplot, HiC, canvas2d-fallback, canvas2d-variants, rendering-backends, color-by-tag, wiggle-color, workspaces, session-spec, demo-inventory, svg-export, authentication, main-thread-rpc, custom-url, redraw, basic-lgv, misc
- Screenshot comparison via pixelmatch (threshold 0.1)
- Backend-specific golden snapshots in `__snapshots__/{webgl,webgpu,canvas2d}/`
- `--backend=webgl|webgpu|canvas2d` flag, `--filter=` for running subsets
- `compare-backends.ts` for cross-backend visual regression (categories: identical, similar <5%, different ≥5%)
- Unit tests co-located with source (`*.test.ts`) using Jest with jsdom — **157 tests across 15 suites** in modified plugins
- Canvas 2D renderer unit tests use mock canvas context pattern (20 tests including picking)
- Density-based feature limit unit tests (7 tests covering all threshold scenarios)
- Strand swap coordinate tests (4 tests covering all strand×reversed combinations)
- `copyView.renameIds()` unit tests (8 tests verifying ID uniqueness)
- Fetch autorun tests include error recovery via `reload()` flow
- Browser test runner forwards `[alignments]` and `[webgl-wiggle]` console logs for debugging

---

## Items Flagged as Unclear

These need investigation or clarification before they can be scoped:

1. **"Zoom to full" not working in synteny** — needs verification of what's broken
2. **"Don't colorize indels" not working in synteny** — needs verification
3. **Y-scale bar offset per row in wiggle** — unclear how to reproduce
4. **Brief tooltip flash in top left on wiggle-multi** — intermittent, needs repro steps
5. **`staticBlocks` usage** — Used by MultiRegionDisplayMixin for pre-expanded fetch regions. The fetch autorun uses `view.staticRegions` which merges 800px chunks. A fast-path cache only recalculates when bpPerPx/width/displayedRegions change or offsetPx moves outside a coverage range. This can cause a mismatch with `visibleRegions` used by rendering — potential root cause of P1.2 wiggle fetch gaps.
6. ~~**Force load "slightly stuck"**~~ **FIXED** — `ClearBlockingStateOnViewportChange` now clears on zoom OR region change (tracks `mergedVisibleRegions` key); density-based threshold (`maxFeatureDensity=20` features/px) replaces absolute `maxFeatureCount=5000`; "force load" button triples the density limit.
7. **Density track mismatch** — "sidebar turns into density in SVG export but is still xyplot in browser" — is this a labeling bug or rendering bug?
8. **Issues toggling matrix/non-matrix variant modes** — "maybe related to phased being on or tree?" — needs investigation
9. ~~**Color change wiggle "sometimes" not working**~~ **INVESTIGATED** — e2e test (`wiggle-color.ts`) proves autorun correctly re-fires on color change. If issue recurs, debug logging can be re-added.
10. **Unmapped mate** — "get more info??" — unclear what info is needed
11. **"Distinguish initialized concepts in linear genome view"** — what does this mean concretely?
12. **Custom Google Analytics** — unclear scope/purpose
13. **Refactor Apollo client-side code** — out of scope for this branch?

---

## Recent Changes (2026-03-14)

### Canvas2D Alignments: Full Color Scheme Support
The `Canvas2DAlignmentsRenderer` now implements all 9 color schemes via a `switch` on `colorScheme`:
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

### Density-Based Feature Limits
Replaced absolute `maxFeatureCount=5000` with `maxFeatureDensity=20` (features per pixel). The RPC handler now computes `featureDensity = featuresArray.length / regionWidthPx` and only triggers "region too large" when density exceeds the limit. This means the 1000 Genomes human genes track no longer triggers force-load prematurely at reasonable zoom levels.

### Viewport-Aware Error Recovery
`ClearBlockingStateOnViewportChange` autorun now tracks both `bpPerPx` and a `mergedVisibleRegions` key. Panning to a new chromosome or region clears `regionTooLarge`/`error` state, not just zooming.

### Canvas2D Synteny Picking
Implemented `pick()` in `Canvas2DSyntenyRenderer` using `isPointInPath()`. Stores last render parameters (offsets, scales, bpPerPx) and iterates features in reverse draw order so top-most features are picked first. Handles both straight parallelograms and curved features. Added 7 new unit tests for picking.

### Synteny Browser Test Fix
Added `drawn-${drawn}` data-testid to the synteny rendering component wrapper div. Previously, synteny browser tests captured blank white snapshots because `waitForCanvasRendered` had no way to detect when synteny data was loaded and rendered (no loading overlay, no drawn signal). The `drawn` state is derived from `model.gpuInitialized && !!model.featureData`.

### Error Handling Improvements
- Synteny draw autorun: added try/catch around rendering operations that sets `model.error` on failure
- Synteny rendering component: added `ErrorMessage` display when `model.error` is set
- Previously errors were `setError()`'d but never rendered in the synteny UI

### Yeast Synteny Split Fix
Fixed `renameIds()` in `copyView.ts` — was concatenating `${oldId}-${newId}` which could break MST `types.identifier` uniqueness in synteny's nested `levels` array. Now uses the generated ID directly.

### Strand Swap Coordinate Tests
Added 4 unit tests verifying synteny parallelogram crossing behavior for all strand×reversed combinations. Confirmed that the double-flip (strand=-1 + reversed region) producing parallel lines is the correct biological behavior.

### Debug Logging
- Alignments model: logs tag color discovery and re-fetch triggers (`[alignments]` prefix)
- Browser test runner: forwards `[alignments]` console messages alongside existing `[webgl-wiggle]` messages

---

## Cross-Backend Verification Matrix

All track types must work across 4 rendering backends. Key: W=WebGPU, G=WebGL, C=Canvas2D, S=SVG export. ✓=done, ~=partial, ✗=missing, -=N/A

| Display Type | W | G | C | S | Notes |
|---|---|---|---|---|---|
| Alignments (pileup) | ✓ | ✓ | ✓ | ✓ | All 9 color schemes in Canvas2D |
| Alignments (coverage) | ✓ | ✓ | - | ✓ | Coverage rendered by GPU only + SVG |
| Alignments (SNP coverage) | ✓ | ✓ | - | ✓ | |
| Alignments (arcs/sashimi) | ✓ | ✓ | - | ✓ | Sashimi arcs in SVG via path elements |
| Alignments (CIGAR gaps) | ✓ | ✓ | ✓ | ✓ | |
| Alignments (modifications) | ✓ | ✓ | - | ✓ | |
| Features (genes, etc.) | ✓ | ✓ | ✓ | ✓ | Peptide monospace font fixed |
| Wiggle (single) | ✓ | ✓ | ✓ | ✓ | |
| Wiggle (multi) | ✓ | ✓ | ✓ | ✓ | |
| Variants (multi-sample) | ✓ | ✓ | ✓ | ✓ | |
| Variants (matrix) | ✓ | ✓ | ✓ | ✓ | |
| Variants (LD) | ✓ | ✓ | ✓ | ✓ | GPU compute for LD calculation |
| Sequence | ✓ | ✓ | - | ✓ | Monospace font fixed in SVG |
| Synteny | ✓ | ✓ | ✓ | ✓ | Picking works in Canvas2D |
| Dotplot | ✓ | ✓ | ✓ | ✓ | |
| HiC | ✓ | ✓ | ✓ | ✓ | |

### Next Steps — Cross-Backend Testing

1. **Add browser tests per backend**: Run SVG export tests with `--backend=canvas2d` to ensure Canvas2D fallback produces valid output for all track types
2. **Cross-backend visual regression**: Use `compare-backends.ts` to flag rendering differences between WebGL and Canvas2D for each track type
3. **Coverage sub-renderers in Canvas2D**: Coverage histogram, SNP coverage, noncov histogram, and modification coverage currently only render via GPU — add Canvas2D fallback for these if needed for `?gpu=off` mode
4. **Multi-wiggle error recovery**: GPU renderer init happens once in `useEffect`; if context is lost during error, retry doesn't re-init. Need to track renderer validity and re-create on error recovery.

### Next Steps — Remaining Bugs

**P2 (High):**
- Dotplot: color should be red (positive strand) vs blue (negative strand) — verify `dotplotWebGLColors.ts` strand mapping
- ~~Dotplot: scroll speed too fast~~ **DONE**
- ~~Multi-wiggle overlay color misalignment~~ **DONE**
- Wrong ratio over deletions tooltip — verify fix is complete
- Insertion depth calculation — `Math.max(leftDepth, rightDepth)` may use wrong indices

**P3 (Medium):**
- Labels disappear during zoom — `floatingLabelsData` baked at fetch time, not reconstructed on zoom
- Infinite loop after error in multi-wiggle — dual error state (React + model) may desync
- Outline on alignments shift+scroll — needs investigation

## Blog Post Ideas (Non-blocking)

- State management pokes holes in the declarative beauty of React
- When your abstractions and assumptions need to go away
- Doing more ambitious things with browser graphics APIs
