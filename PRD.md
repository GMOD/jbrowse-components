# JBrowse 2 WebGL/WebGPU Migration — Project Requirements Document

**Branch:** `webgl-poc`
**Last updated:** 2026-03-13
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
- Canvas 2D synteny picking (`pick()`) returns -1 — no feature picking in Canvas 2D mode yet
- Canvas 2D LD renderer does nearest-neighbor color ramp sampling (no interpolation like GPU)

### P1.2 Data Fetching / Redraw Reliability

**Why:** Core usability — users zoom out on alignments tracks and the view doesn't redraw. This makes the app appear broken.

**Requirements:**
- ~~Debug re-requests to ensure data is fetched for the entire visible region~~ **DONE** — replaced `staticRegions` (legacy 800px-block-based) with viewport-based `mergedVisibleRegions` + explicit 50% buffer
- ~~Audit wiggle tracks: "not fetching data in entire visible region sometimes"~~ **DONE** — integrated `isCacheValid()` for resolution-aware re-fetching on zoom-in; removed stale-region-based fetch
- ~~Investigate `staticBlocks` usage and whether it's still needed~~ **DONE** — `staticBlocks` kept for UI (scalebar/gridlines), but `staticRegions` removed from data fetching; replaced with direct viewport-based approach
- Fix: "1kg Human demo: the genes track triggers force load too soon"

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
| Color by per-base quality | Not implemented |
| Color by insert size (threshold vs gradient) | Not implemented |
| Color by mapping quality — add legend | **DONE** — HSL gradient legend items added |
| Color by tag not working | Pipeline is complete (tag extraction → colorTagMap → GPU upload → shader). Likely timing issue: colorTagMap starts empty and needs two fetches (first discovers tags, second applies colors). Investigate re-fetch trigger in model.ts lines 1598-1629. |
| Color orange for supplementary reads | Already implemented in normal color scheme (all 3 backends) — verify other color modes |
| Force load stuck | Partially broken |
| Wrong ratio shown over deletions in tooltip | |
| Coverage interbase indicators conditional on total coverage | |
| Non-intron rendered on sidescroll weirdly for iso-seq | |
| volvox-long reads with SV not rendering when zoomed out | |
| Insertion depth weird | |
| Draw outline even when compact | **DONE** — size threshold lowered from 4px to 2px |
| Linked read mode not wired up | Invalidation autorun watches showLinkedReads and should trigger clearAllRpcData(). Migration code now sets colorBySetting to insertSizeAndOrientation. Investigate if demo #15 snapshot still fails to load. |
| Read vs ref synteny view not working | Observed in SKBR3 PacBio demo |
| Sort modifications — last color by option | |
| Put arc color scheme in color by | |
| Bad triangle interbase indicators | |
| Outline on alignments shift+scroll | |
| Click sashimi — make it look selected (selected color arc) | |
| Unmapped mate coloring collides with other pink | |
| Hide insertions in low coverage when region has high coverage | |
| Reset mouseover after change link mode | **DONE** — clears featureIdUnderMouse/highlightedChainIds on toggle |
| WebGL arcs not vibrant | **DONE** — premultiplied alpha fix in arc/sashimi WGSL shaders |
| Clicking chain — get both feature info | |

### P2.2 Wiggle Track Bugs

| Bug | Notes |
|-----|-------|
| Color change wiggle not working (sometimes) | |
| Cross hatches | **DONE** — `displayCrossHatches` toggle + SVG overlay |
| Multi-wiggle color with overlapping modes | Unintended same color |
| Overlapping line whiskers | Single color whiskers option? |
| Y-scale bar offset per row | Unclear repro |
| Refresh after multi-wiggle fails also fails | |
| Density vs XYPlot mismatch between sidebar and SVG export | |
| Sidebar legend toggle distinct from tree sidebar | |
| **UNCLEAR:** Brief tooltip flash in top left on wiggle-multi | Needs investigation |

### P2.3 Synteny / Comparative Views

| Bug | Notes |
|-----|-------|
| Hs1 vs mm39 synteny — excessively slow, causes freeze | **HIGH PRIORITY** — renders but unusable |
| Yeast synteny — error when splitting | |
| Multi-way synteny (grape/peach/cacao) — synteny tracks fail to load | |
| Zoom to full not working? | **UNCLEAR** — needs verification |
| Don't colorize indels not working? | **UNCLEAR** — needs verification |
| Split indels code | Refactoring task |
| Horizontally flipped stuff is inaccurate | Gallery demo broken |
| Color dotplot red vs black | |
| Make scrolling dotplot a little slower | |
| Linked dotplot and synteny view | Idea / future feature |
| Swap axes dotplot | Idea / future feature |
| Swap axes linear synteny view | Idea / future feature |

### P2.4 SVG Export Issues

| Bug | Notes |
|-----|-------|
| Y scale bars wrong in multi-wiggle (no scalebar label offset) | Also check in main app |
| Monospace font on sequence track | |
| Monospace font on peptides | |
| Alignments SVG: indels too visible in SKBR3 output | |

### P2.5 Variant Track Issues

| Bug | Notes |
|-----|-------|
| Toggling between matrix and non-matrix modes | Maybe related to phased/tree? |
| Clicking multisample variant — not enough detail | |
| Tetraploid potato — maybe failed to load matrix | |
| Human trio phased VCF rendering | Needs verification |

---

## Priority 3 — Medium / Polish

### P3.1 Canvas/Interaction Bugs

- After zoom, features reposition but mouseover shading stuck
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
| 7 | Yeast synteny | Partial | Error when splitting |
| 8 | Human HG002 insertion | Working | |
| 9 | SKBR3 breakpoint split view | Working | |
| 10 | Nanopore methylation/modifications | Working | |
| 11 | 1000 genomes extended trio | Working | |
| 12 | ENCODE multi-bigwig | Working | |
| 13 | COLO829 melanoma multi-bigwig | Working | |
| 14 | Inversion (single row BSV) | Working | Track move bug noted |
| 15 | Inversion (linked reads) | Broken | Snapshot fails, wrong visualization |
| 16 | Multi-way synteny (grape/peach/cacao) | Broken | Synteny tracks fail to load |
| 17 | Tetraploid potato multi-sample VCF | Partial | Matrix may fail to load |
| 18 | Human trio phased VCF | Working | |
| 19 | Hi-C contact matrix | Working | |
| 20 | Horizontally flip demo | Broken | Flipped positions inaccurate |
| 21 | COLO829 melanoma coverage | Partial | Settings not loaded from snapshot |
| 22 | GIAB heterozygous deletion | Partial | Color by tag not working |
| 23 | SKBR3 PacBio read vs ref | Partial | Read vs ref synteny broken |
| 24 | CpG methylation nanopore | Partial | Color by reference CpG broken |
| 25 | 1000 genomes SV large inversion | Broken | Not yet working |

**Working: 12 | Partial: 6 | Broken: 5 | Untested: 2**

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
- 14+ test suites covering: alignments, bigwig, variants, synteny, dotplot, HiC, canvas2d-fallback, etc.
- Screenshot comparison via pixelmatch (threshold 0.1)
- Backend-specific golden snapshots in `__snapshots__/{webgl,webgpu,canvas2d}/`
- `--backend=webgl|webgpu|canvas2d` flag, `--filter=` for running subsets
- `compare-backends.ts` for cross-backend visual regression (categories: identical, similar <5%, different ≥5%)
- Unit tests co-located with source (`*.test.ts`) using Jest with jsdom
- Canvas 2D renderer unit tests use mock canvas context pattern

---

## Items Flagged as Unclear

These need investigation or clarification before they can be scoped:

1. **"Zoom to full" not working in synteny** — needs verification of what's broken
2. **"Don't colorize indels" not working in synteny** — needs verification
3. **Y-scale bar offset per row in wiggle** — unclear how to reproduce
4. **Brief tooltip flash in top left on wiggle-multi** — intermittent, needs repro steps
5. **`staticBlocks` usage** — Used by MultiRegionDisplayMixin for pre-expanded fetch regions. The fetch autorun uses `view.staticRegions` which merges 800px chunks. A fast-path cache only recalculates when bpPerPx/width/displayedRegions change or offsetPx moves outside a coverage range. This can cause a mismatch with `visibleRegions` used by rendering — potential root cause of P1.2 wiggle fetch gaps.
6. **Force load "slightly stuck"** — Root cause identified: in `MultiRegionDisplayMixin`, once `regionTooLarge=true`, the fetch autorun early-returns and only clears when zoom *changes*. If user is already zoomed out, no new zoom event fires so the state persists. Additionally, the canvas plugin uses a `maxFeatureCount=5000` threshold separate from the byte estimate check — the 1kg genes demo likely exceeds this count threshold even though rendering would be feasible.
7. **Density track mismatch** — "sidebar turns into density in SVG export but is still xyplot in browser" — is this a labeling bug or rendering bug?
8. **Issues toggling matrix/non-matrix variant modes** — "maybe related to phased being on or tree?" — needs investigation
9. **Color change wiggle "sometimes" not working** — intermittent, needs repro
10. **Unmapped mate** — "get more info??" — unclear what info is needed
11. **"Distinguish initialized concepts in linear genome view"** — what does this mean concretely?
12. **Custom Google Analytics** — unclear scope/purpose
13. **Refactor Apollo client-side code** — out of scope for this branch?

---

## Blog Post Ideas (Non-blocking)

- State management pokes holes in the declarative beauty of React
- When your abstractions and assumptions need to go away
- Doing more ambitious things with browser graphics APIs
