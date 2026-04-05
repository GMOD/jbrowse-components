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

**Requirements:**

- WebGPU does not work on CI action runners — tests must work with WebGL and
  Canvas fallback

### P1.4 Demo Session Loading

- Many shared session links fail to load or load with incorrect settings. This
  is the primary way users encounter the app.

### Extra ideas

Make curvy breakpoint split view lines in the alignments track for link
paired/supp reads

- Idea: The 'Link supplementary alignments has the concept of connecting reads
  using a single line. But, we have logic in breakpoint split view for properly
  linking the ORIENTATION of the reads using curved lines. evaluate whether we
  can do this in the Linked paired end/supplementary reads mode in the normal
  alignments track. If might be a separate mode from Link supplementary reads,
  like "Link paired/supp reads with curved lines"

## Priority 4 — Low / Future Enhancements

### P4.3 Loading old configs

- Ensure all old renderer configuration settings e.g. PileupRenderer (which were
  all effectively removed) are mapped to new display model settings (e.g. to
  LinearAlignmentsDisplay)

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

## Next Steps

### Cross-Backend Testing

1. **Cross-backend visual regression**: Use `compare-backends.ts` to flag
   rendering differences between WebGL and Canvas2D for each track type
