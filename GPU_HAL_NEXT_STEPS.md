# GPU HAL: Status and Next Steps

## What's Done

All GPU renderers across the codebase now use the HAL (Hardware Abstraction Layer),
eliminating separate WebGL2 and WebGPU implementations.

| Renderer | Before (WebGL+WebGPU) | After (unified) | Reduction |
|----------|----------------------|-----------------|-----------|
| Alignments | 4,734 | 1,313 | 72% |
| MultiSynteny | 1,148 | 268 | 77% |
| LinearSynteny | 978 | 227 | 77% |
| Dotplot | 496 | 106 | 79% |
| Wiggle | 683 | 174 | 75% |
| Variant | 746 | 292 | 61% |
| VariantMatrix | 450 | 147 | 67% |
| **Total plugin code** | **9,235** | **2,527** | **73%** |
| HAL infrastructure | — | ~1,060 | (shared) |

Other completed work:
- GLSL shaders converted from named uniforms to UBO accessors
- `flip_x` and `U_REVERSED` added to WGSL/GLSL preambles
- HP function 2-arg wrappers (`hp_clip_x`, `hp_linear`) in both WGSL and GLSL
- `syntenyOpsVisitor` → `@jbrowse/alignments-core/cigarOpsVisitor`
- Shared SNP/indicator GPU packing in `coverageGpuPacking.ts`
- naga-based WGSL shader validation test (17 alignments shaders)
- Pipeline caching fixed for multi-HAL-instance devices
- WebGL2 scissor/viewport state leak fixed in beginFrame/endFrame

## Next Steps

### Extend shader validation to all plugins

The alignments plugin has a naga-based test that validates all 17 WGSL shaders at
test time. The same approach should cover the other plugins' shaders. This would
have caught the `hp_scale_linear` 2-arg bug before it reached the browser.

Shaders not yet covered:
- `plugins/wiggle/src/shared/wiggleShader.ts` (~200 lines WGSL)
- `plugins/variants/.../variantShaders.ts` (~50 lines WGSL)
- `plugins/linear-comparative-view/.../wgslShaders.ts` (~300 lines WGSL)
- `plugins/linear-comparative-view/.../multiSyntenyGpuShaders.ts` (~500 lines WGSL)
- `plugins/dotplot-view/.../dotplotShaders.ts` (~80 lines WGSL)
- `plugins/canvas/.../sharedRendererConstants.ts` (~100 lines WGSL)

Approach: one test file per plugin that imports the evaluated shader strings and
runs `naga` on each. Could also be a single cross-plugin test in `packages/core`.

### glAttribute ↔ shader sync validation

The `PassDescriptor.glAttributes` array defines how WebGL2 maps buffer data to
vertex attributes. If the attribute names, types, or offsets don't match the GLSL
`in` declarations, rendering silently fails (wrong data or missing attributes).

A test could parse the GLSL shader source for `in` declarations and verify they
match the `glAttributes` array — names, component counts, and types. This is purely
string-based (regex on GLSL source + comparison with the PassDescriptor metadata),
no GPU device needed.

### Uniform layout unification (coverage sharing)

The alignments and multi-synteny renderers both render coverage bars, SNP segments,
and insertion indicators with nearly identical shader logic. They can't share shaders
today because their uniform layouts differ:

- Alignments: 640-byte flat `array<vec4u, 40>` with `uf()/uu()/ui()` accessors
- MultiSynteny: 112-byte named struct with direct field access

To share coverage shaders:
- Define a shared "coverage uniform block" in `@jbrowse/alignments-core`
- Both renderers pack the shared fields (canvas size, coverage height, depth scale,
  domain range, base colors) into the same slots
- Coverage/SNP/indicator WGSL+GLSL shaders move to `alignments-core`
- Each renderer still has its own non-coverage uniforms beyond the shared block

This is a medium-sized refactor. The shared block would cover ~20 uniform slots.

### GLSL codegen from WGSL

The HAL's `PassDescriptor` already contains both WGSL and GLSL shader sources, plus
the `glAttributes` array that fully describes the instance data layout. A codegen
tool could generate the GLSL vertex shader from the WGSL source:

- Parse WGSL struct fields → generate GLSL `in` attribute declarations
- Translate WGSL uniform accessors → GLSL UBO accessors (same `uf()/uu()` pattern)
- Translate WGSL storage buffer reads → GLSL attribute reads
- Core math is identical between WGSL and GLSL 300 ES

The hardest part (mapping storage buffer access patterns to vertex attributes) is
now fully described by `glAttributes`, making mechanical translation feasible.

This would eliminate the need to maintain GLSL shaders by hand and remove the
WGSL↔GLSL sync maintenance burden entirely.

### Canvas2D renderer consolidation

Seven Canvas2D fallback renderers exist (~2,400 lines total). Several share patterns
with each other and with the GPU renderers. The coverage rendering logic in
`Canvas2DAlignmentsRenderer` (1,232 lines) and `Canvas2DMultiSyntenyRenderer`
(250 lines) overlaps significantly. Extracting shared Canvas2D coverage drawing
utilities to `alignments-core` would reduce duplication.

### GPU renderer integration tests

Currently only the Canvas2D renderers have integration tests. The GPU renderers
could benefit from tests that:
- Verify data packing produces correct buffer layouts
- Verify uniform filling covers all required slots
- Verify pass descriptors have consistent stride/attribute definitions
- Mock the HAL to test the render loop logic without a real GPU

The `multiSyntenyGpuData.test.ts` (404 lines) is a good model for this approach.
