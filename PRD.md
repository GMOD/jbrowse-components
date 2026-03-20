# JBrowse 2 WebGL/WebGPU Migration — Project Requirements Document

**Branch:** `webgl-poc` **Last updated:** 2026-03-17 **Status:** Active
development — many features working, significant polish and testing needed

> **Note:** When items are completed, move them to `COMPLETED.md`.

---

## Executive Summary

JBrowse 2 is being migrated from its block-based HTML canvas rendering to a
unified GPU-accelerated rendering pipeline supporting three backends:
**WebGPU**, **WebGL 2.0**, and **HTML5 Canvas** (fallback + SVG export). The
branch has working implementations for most track types with known bugs and gaps
documented below.

---

## Priority 1 — Critical / Blocking

These issues block production readiness or affect the majority of users.

### P1.3 Expand Browser Test Suite

**Why:** Need confidence that changes don't regress across backends. Current
suite has 14 test files but many features/demos are untested.

**Requirements:**

- WebGPU does not work on CI action runners — tests must work with WebGL and
  Canvas fallback
- Add puppeteer screenshot tests covering all demo/gallery URLs listed in the
  demo inventory below
- Compare whole-page screenshots (block-based comparison from `origin/main`
  doesn't apply here)
- Tests should be runnable against both `origin/main` and `webgl-poc` branch for
  comparison
- Existing infrastructure: `browser-tests/runner.ts`, `snapshot.ts` with
  pixelmatch, `compare-backends.ts`

### P1.4 Demo Session Loading

**Why:** Many shared session links fail to load or load with incorrect settings.
This is the primary way users encounter the app.

**Requirements:**

- Audit all demo/gallery URLs (see inventory below) and fix session loading
  errors
- Ensure `types.refinement` from MST v5.6.0 provides fallbacks when state tree
  fails to load
- Map all old "renderer" concepts to new display model settings
- Ensure all demo sessions load without error

---

## Priority 2 — High / Major Feature Gaps

These affect significant user-visible functionality.

### P2.1 Alignments Track Bugs

| Bug                                    | Notes                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color orange for supplementary reads   | Already implemented in normal color scheme (all 3 backends) — verify other color modes                                                                                                                                    |
| Clicking chain — get both feature info | Already partially covered: SA tag parsed and shown by `SupplementaryAlignments` component; paired-end mate info shown by `LinkedPairedAlignments`. Could enhance by fetching full partner feature data via RPC on demand. |

### P2.2 Wiggle Track Bugs

| Bug                                                          | Notes                                                                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overlapping line whiskers                                    | Single color whiskers option?                                                                                                                         |
| Y-scale bar offset per row                                   | Unclear repro                                                                                                                                         |
| Sidebar legend toggle distinct from tree sidebar             |                                                                                                                                                       |
| **UNCLEAR:** Brief tooltip flash in top left on wiggle-multi | Needs investigation                                                                                                                                   |
| Density vs XYPlot mismatch between sidebar and SVG export    | Investigated — code analysis shows sidebar, main display, and SVG export all read from same `model.renderingType` getter. Cannot reproduce from code. |

### P2.3 Synteny / Comparative Views

| Bug                                                   | Notes                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| Hs1 vs mm39 synteny — excessively slow, causes freeze | Improved (viewport culling added) — further LOD improvements needed |
| Zoom to full not working?                             | **UNCLEAR** — needs verification                                    |
| Don't colorize indels not working?                    | **UNCLEAR** — needs verification                                    |
| Split indels code                                     | Refactoring task                                                    |
| Linked dotplot and synteny view                       | Idea / future feature                                               |
| Swap axes dotplot                                     | Idea / future feature                                               |
| Swap axes linear synteny view                         | Idea / future feature                                               |

### P2.5 Variant Track Issues

| Bug                                             | Notes              |
| ----------------------------------------------- | ------------------ |
| Tetraploid potato — maybe failed to load matrix |                    |
| Human trio phased VCF rendering                 | Needs verification |

---

## Priority 3 — Medium / Polish

### P3.1 Canvas/Interaction Bugs

- Hot module reload breaks canvas features
- Per-track scrolling — verify working
- After fatal error: `Uncaught Error: no containing view found` in
  `getContainingView`
- Closing track errors (non-webgl bug)
- Dockview move to right side of screen not working (non-webgl bug)

### P3.2 Breakpoint Split View

- Overlay can show when forceload visible
- Inversion example: tracks moved around in view may have bugs
- Hybrid long read breakpoint split view display (following read chain path)

### P3.3 Non-WebGL Bugs

- Diagonalization: yeast works, grape vs peach unclear
- Opening reference sequence track with `umd_plugin.js` gives
  `TypeError: Cannot assign to read only property 'metadata'` — need to handle
  frozen objects from extension points
- Small white block in sequence track

### P3.4 Methylation / Modifications

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

### P4.4 Automatic Noisiness Scaling for Feature Frequency Thresholds

Compute a per-track noise estimate (e.g., mean insertion rate across sampled
positions) during coverage computation and use it to automatically scale the
`featureFrequencyThreshold` curve. Noisy long-read tracks (PacBio CLR) would get
stricter thresholds while clean short-read tracks stay unchanged. The data is
already available in `computePositionFrequencies`; main work is threading the
stat through the RPC boundary and choosing a good baseline expected noise rate.

### P4.5 Option to Disable Sub-Pixel Feature Fade

Add a per-track option to disable the sub-pixel alpha fade that hides
low-frequency features when zoomed out. High-quality reads (e.g., Illumina,
PacBio HiFi) have very few sequencing errors, so most mismatches and insertions
are real variants that users may want to see at all zoom levels regardless of
frequency. When enabled, features would render at full opacity whenever they are
present, bypassing both the zoom-based alpha and the frequency-based importance
scaling.

### P4.6 UI/UX Ideas (Unscoped)

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

Status key: **Working**, **Partial** (loads with issues), **Broken** (fails to
load or unusable)

| #   | Demo                                             | Status  | Notes                                                                                     |
| --- | ------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------- |
| 1   | Volvox (genes, sequence, variants, multi-wiggle) | Working |                                                                                           |
| 2   | SARS-CoV2                                        | Working | Occasional label collision                                                                |
| 3   | Breakpoint split view                            | Working | Nice scroll zoom                                                                          |
| 4   | Dotplot (grape vs peach)                         | Working | Smooth scroll zoom                                                                        |
| 5   | Synteny (grape vs peach)                         | Working |                                                                                           |
| 6   | Hs1 vs mm39 synteny                              | Broken  | Excessively slow, freezes; viewport culling added but further LOD needed                  |
| 7   | Yeast synteny                                    | Working | Error when splitting fixed                                                                |
| 8   | Human HG002 insertion                            | Working |                                                                                           |
| 9   | SKBR3 breakpoint split view                      | Working |                                                                                           |
| 10  | Nanopore methylation/modifications               | Working |                                                                                           |
| 11  | 1000 genomes extended trio                       | Working |                                                                                           |
| 12  | ENCODE multi-bigwig                              | Working |                                                                                           |
| 13  | COLO829 melanoma multi-bigwig                    | Working |                                                                                           |
| 14  | Inversion (single row BSV)                       | Working | Track move bug noted                                                                      |
| 15  | Inversion (linked reads)                         | Partial | `invalidateLoadedRegions()` fix applied — needs browser verification                      |
| 16  | Multi-way synteny (grape/peach/cacao)            | Partial | Session-spec init fixed (per-level tracks). Shared session link may need level migration. |
| 17  | Tetraploid potato multi-sample VCF               | Partial | Matrix may fail to load                                                                   |
| 18  | Human trio phased VCF                            | Working |                                                                                           |
| 19  | Hi-C contact matrix                              | Working |                                                                                           |
| 20  | Horizontally flip demo                           | Partial | Coordinate math verified correct; blank snapshots fixed — needs browser re-verification   |
| 21  | COLO829 melanoma coverage                        | Partial | Settings not loaded from snapshot                                                         |
| 22  | GIAB heterozygous deletion                       | Working | Color by tag now working (all 10 color schemes in Canvas2D)                               |
| 23  | SKBR3 PacBio read vs ref                         | Working | Read vs ref fixed (display name mismatch)                                                 |
| 24  | CpG methylation nanopore                         | Partial | CpG off-by-one fixed — needs browser verification                                         |
| 25  | 1000 genomes SV large inversion                  | Working |                                                                                           |

**Working: 15 | Partial: 6 | Broken: 1 | Untested: 2**

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
- `?gpu=off` — disable GPU (uses Canvas 2D fallback)
- Default: auto-detect (WebGPU → WebGL2 → Canvas 2D)

### Test Infrastructure

- Puppeteer-based browser tests in `products/jbrowse-web/browser-tests/`
- **21 test suites** with **~120 test cases** covering: alignments, bigwig,
  variants, synteny, dotplot, HiC, canvas2d-fallback (8 tests: features,
  multi-track, zoom, alignments+coverage, SNP coverage, arcs, sequence, wiggle),
  canvas2d-variants, rendering-backends (16 tests: VCF, GFF3, wiggle, BAM/CRAM
  pileup, SNP coverage, multi-wiggle, SV, JEXL, sequence, alignments+coverage,
  arcs, synteny LGV, synteny linear, dotplot), color-by-tag, wiggle-color,
  workspaces, session-spec, demo-inventory, svg-export, authentication,
  main-thread-rpc, custom-url, redraw, basic-lgv, misc
- Screenshot comparison via pixelmatch (threshold 0.1)
- Backend-specific golden snapshots in `__snapshots__/{webgl,webgpu,canvas2d}/`
- `--backend=webgl|webgpu|canvas2d` flag, `--filter=` for running subsets
- `compare-backends.ts` for cross-backend visual regression (categories:
  identical, similar <5%, different ≥5%)
- Unit tests co-located with source (`*.test.ts`) using Jest with jsdom — **157
  tests across 15 suites** in modified plugins
- Canvas 2D renderer unit tests use mock canvas context pattern (20 tests
  including picking)
- Density-based feature limit unit tests (7 tests covering all threshold
  scenarios)
- Strand swap coordinate tests (4 tests covering all strand×reversed
  combinations)
- `copyView.renameIds()` unit tests (8 tests verifying ID uniqueness)
- Fetch autorun tests include error recovery via `reload()` flow
- Interbase indicator tests (7 tests for `computeNoncovCoverage` threshold
  logic, depth boundaries, dominant type selection)
- Interbase frequency tests (6 tests for `computePositionFrequencies`
  edge/cliff/offset cases)
- Depth-dependent threshold tests (2 tests for `applyDepthDependentThreshold`
  interbase mode)
- `featureFrequencyThreshold` tests (5 tests covering step boundaries,
  interpolation, monotonicity)
- Floating label regression test verifying description data stability across
  zoom levels
- Browser test runner forwards `[alignments]` and `[webgl-wiggle]` console logs
  for debugging

---

## Cross-Backend Verification Matrix

All track types must work across 4 rendering backends. Key: W=WebGPU, G=WebGL,
C=Canvas2D, S=SVG export. ✓=done, ~=partial, ✗=missing, -=N/A

| Display Type               | W   | G   | C   | S   | Notes                                                            |
| -------------------------- | --- | --- | --- | --- | ---------------------------------------------------------------- |
| Alignments (pileup)        | ✓   | ✓   | ✓   | ✓   | All 11 color schemes in Canvas2D                                 |
| Alignments (coverage)      | ✓   | ✓   | ✓   | ✓   | Canvas2D `drawCoverage()` implemented                            |
| Alignments (SNP coverage)  | ✓   | ✓   | ✓   | ✓   | Canvas2D `drawSnpCoverage()` implemented                         |
| Alignments (arcs/sashimi)  | ✓   | ✓   | ✓   | ✓   | Canvas2D `drawArcs()`/`drawSashimiArcs()`                        |
| Alignments (CIGAR gaps)    | ✓   | ✓   | ✓   | ✓   |                                                                  |
| Alignments (modifications) | ✓   | ✓   | ✓   | ✓   | Canvas2D `drawModifications()` implemented                       |
| Features (genes, etc.)     | ✓   | ✓   | ✓   | ✓   | Peptide monospace font fixed                                     |
| Wiggle (single)            | ✓   | ✓   | ✓   | ✓   |                                                                  |
| Wiggle (multi)             | ✓   | ✓   | ✓   | ✓   |                                                                  |
| Variants (multi-sample)    | ✓   | ✓   | ✓   | ✓   |                                                                  |
| Variants (matrix)          | ✓   | ✓   | ✓   | ✓   |                                                                  |
| Variants (LD)              | ✓   | ✓   | ✓   | ✓   | GPU compute for LD calculation                                   |
| Sequence                   | ✓   | ✓   | ✓   | ✓   | Canvas2D fallback via `initCanvas2D()` in WebGPUSequenceRenderer |
| Synteny                    | ✓   | ✓   | ✓   | ✓   | Picking works in Canvas2D                                        |
| Dotplot                    | ✓   | ✓   | ✓   | ✓   |                                                                  |
| HiC                        | ✓   | ✓   | ✓   | ✓   |                                                                  |

---

## Next Steps

### Cross-Backend Testing

1. **Add browser tests per backend**: Run SVG export tests with
   `--backend=canvas2d` to ensure Canvas2D fallback produces valid output for
   all track types
2. **Cross-backend visual regression**: Use `compare-backends.ts` to flag
   rendering differences between WebGL and Canvas2D for each track type
3. **Multi-wiggle error recovery**: GPU renderer init happens once in
   `canvasRefCallback` (`MultiWiggleComponent.tsx:115-134`); if context is lost
   during error, retry doesn't re-init. Need to track renderer validity and
   re-create on error recovery. Same pattern may affect `WiggleComponent.tsx`
   and `FeatureComponent.tsx`.
4. **Shader transpilation**: Naga (archived Jan 2025) converts WGSL→GLSL but
   outputs UBO-style bindings instead of vertex attributes, which is
   undesirable. No viable WGSL→GLSL transpiler exists that preserves vertex
   buffer layout. Current approach of maintaining parallel WGSL+GLSL shaders is
   the pragmatic path. sokol-shdc goes GLSL→WGSL (reverse direction) via Tint.

### Remaining Bugs

**P2 (High) — Still Open:**

- Non-intron rendered in collapsed intron view for iso-seq — **LIKELY FIXED**
  (stencil removed), needs browser verification
- Linked read mode (demo #15) — **FIXED** (`invalidateLoadedRegions` added),
  needs browser verification
- Clicking chain — should get both features' info in widget
- Tetraploid potato matrix — may fail to load
- Hs1 vs mm39 synteny still slow — viewport culling helps but further LOD needed
