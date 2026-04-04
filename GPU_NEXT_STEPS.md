# GPU/Canvas2D Renderer — Next Steps

## What's Done

### Infrastructure
- **MockHal** (`packages/core/src/gpu/hal/mockHal.ts`) — records all HAL calls for assertion in tests
- **initDualBackend** (`packages/core/src/gpu/createDualRenderer.ts`) — shared GPU->Canvas2D fallback init, used by all 11 renderer wrappers
- **canvas2dUtils** (`packages/core/src/gpu/canvas2dUtils.ts`) — shared `prepareCanvas`, `clipBlockForCanvas`, `bpToScreenX`, `lookupColorRamp`, `lookupColorRampCSS`
- **rendererUtils** (`packages/alignments-core/src/rendererUtils.ts`) — shared `drawCoverageBins`, `drawSnpSegments`, `drawNoncovSegments`, `drawModCovSegments`, `drawIndicators`, `coverageLayout`, `snpColorForType`, `rgbaString`
- **coverageGpuPacking** (`packages/alignments-core/src/coverageGpuPacking.ts`) — shared `packSnpSegmentsForGpu`, `packNoncovSegmentsForGpu`, `packModCovSegmentsForGpu`, `packIndicatorsForGpu`

### Tests (251 total)
- Naga WGSL shader validation: 16 shaders across 6 plugins
- glAttribute-to-GLSL sync: 174 tests across 8 renderer suites
- GPU integration tests (MockHal): wiggle (14), variant (6), hic (7)
- Shared drawing function unit tests: 11
- Coverage parity tests: 4 (GPU vs Canvas2D produce identical coverage)

### Refactoring
- All 11 renderer wrappers use `initDualBackend`
- MultiSyntenyRenderer unified with single `MultiSyntenyBackend` interface (eliminated `isGpu` branching in model)
- Canvas2D coverage drawing fully uses shared functions (coverage bins, SNP segments, noncov histogram, mod-coverage, indicators)
- Canvas2DAlignmentsRenderer modCov packed into GPU buffer format via `packModCovSegmentsForGpu`
- Canvas2DAlignmentsRenderer noncov packed via `packNoncovSegmentsForGpu` (replaced inline packing)
- Debug console.log cleanup (~25 statements removed)
- Dead legacy code removed (MultiSyntenyGpuBackend, MultiSyntenyCanvasBackend, GpuRenderOpts, Canvas2DMultiSyntenyLegacyRenderer)
- Stale documentation removed (7 outdated AGENTS.md files, GPU_HAL_NEXT_STEPS.md)

## Remaining Opportunities

### High value
- **Snapshot parity tests** — Use node-canvas (like products/jbrowse-web/src/tests) to render coverage through both Canvas2D and a reference path, serialize to PNG, and compare. This would catch visual regressions that unit tests miss (color differences, off-by-one positioning, clipping bugs)

### Medium value
- **GLSL codegen from WGSL** — Mechanically generate GLSL vertex shaders from WGSL using glAttributes metadata, eliminating manual GLSL maintenance
- **Sequence and Graph renderers** — Still use direct WebGPU device access rather than the HAL. Could be migrated for consistency

### Lower value
- **Browser-based snapshot tests** — Puppeteer tests comparing actual GPU rendering output against Canvas2D for specific test datasets. Would require test fixtures with BAM/VCF data
- **Uniform layout unification** — Share coverage uniform slots between alignments and multi-synteny GPU shaders (currently ~20 overlapping slots with slightly different layouts)
